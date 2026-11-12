import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Users, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  course: string;
  year: string;
  email?: string;
}

interface StudentDatabaseManagerProps {
  onStudentDataUpdate: (students: Student[]) => void;
}

export function StudentDatabaseManager({ onStudentDataUpdate }: StudentDatabaseManagerProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load students from localStorage on mount
  useEffect(() => {
    const storedStudents = localStorage.getItem('studentDatabase');
    if (storedStudents) {
      try {
        const parsedStudents = JSON.parse(storedStudents);
        setStudents(parsedStudents);
        onStudentDataUpdate(parsedStudents);
      } catch (error) {
        console.error('Error loading student database:', error);
      }
    }
  }, [onStudentDataUpdate]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setImportStatus('error');
      setImportMessage('Please upload a CSV file');
      return;
    }

    setImportStatus('importing');
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setImportStatus('error');
          setImportMessage('CSV file is empty or invalid');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const students: Student[] = [];

        // Expected CSV format: ID,Name,Course,Year,Email
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length >= 3) { // At least ID, Name, Course
            const student: Student = {
              id: values[0] || '',
              name: values[1] || '',
              course: values[2] || '',
              year: values[3] || '',
              email: values[4] || ''
            };
            
            // Validate student ID
            if (student.id) {
              students.push(student);
            }
          }
        }

        if (students.length === 0) {
          setImportStatus('error');
          setImportMessage('No valid student records found in CSV');
          return;
        }

        // Save to localStorage and update state
        localStorage.setItem('studentDatabase', JSON.stringify(students));
        setStudents(students);
        onStudentDataUpdate(students);
        
        setImportStatus('success');
        setImportMessage(`Successfully imported ${students.length} student records`);
        
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
      } catch (error) {
        console.error('Error parsing CSV:', error);
        setImportStatus('error');
        setImportMessage('Error parsing CSV file. Please check the format.');
      }
    };

    reader.onerror = () => {
      setImportStatus('error');
      setImportMessage('Error reading file');
    };

    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (students.length === 0) {
      setImportStatus('error');
      setImportMessage('No student data to export');
      return;
    }

    const csvContent = [
      'ID,Name,Course,Year,Email',
      ...students.map(student => 
        `${student.id},${student.name},${student.course},${student.year},${student.email || ''}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_database_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleClearDatabase = () => {
    if (window.confirm('Are you sure you want to clear the entire student database? This action cannot be undone.')) {
      localStorage.removeItem('studentDatabase');
      setStudents([]);
      onStudentDataUpdate([]);
      setImportStatus('success');
      setImportMessage('Student database cleared successfully');
    }
  };

  const getStatusIcon = () => {
    switch (importStatus) {
      case 'importing':
        return <Upload className="w-5 h-5 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Users className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border-4 border-yellow-500">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Student Database Management</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {students.length} students
          </span>
          {importStatus !== 'idle' && (
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className={`text-sm ${
                importStatus === 'success' ? 'text-green-600' : 
                importStatus === 'error' ? 'text-red-600' : 'text-blue-600'
              }`}>
                {importMessage}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Import Section */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Import Student Data</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 mb-3">
            <strong>CSV Format:</strong> ID,Name,Course,Year,Email (Email is optional)
          </p>
          <div className="flex items-center space-x-3">
            <input
              ref={fileInputRef}
              type="file"
              id="student-file-upload"
              name="studentFileUpload"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            <button
              onClick={handleExportCSV}
              disabled={students.length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Template
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-3">
        <button
          onClick={handleExportCSV}
          disabled={students.length === 0}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Current Data
        </button>
        <button
          onClick={handleClearDatabase}
          disabled={students.length === 0}
          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear Database
        </button>
      </div>

      {/* Sample Data Preview */}
      {students.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Students</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.slice(0, 5).map((student, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.course}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.year}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length > 5 && (
              <p className="text-sm text-gray-500 mt-2">
                ... and {students.length - 5} more students
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
