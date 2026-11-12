import React, { useState, useEffect } from 'react';

interface Room {
  id: number;
  room_name: string;
  library: string;
  floor: string;
  section: string;
  room_type: string;
  capacity: number;
  status: string;
}

export function RoomsSection() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/rooms')
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setRooms(result.data || []);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch rooms:', err);
        setLoading(false);
      });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-400 bg-green-500/20';
      case 'occupied': return 'text-red-400 bg-red-500/20';
      case 'maintenance': return 'text-yellow-400 bg-yellow-500/20';
      case 'reserved': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getSectionColor = (section: string) => {
    switch (section) {
      case 'Main Library': return 'bg-blue-500/20 text-blue-400';
      case 'Learning Commons': return 'bg-green-500/20 text-green-400';
      case 'Meeting Room': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const groupedRooms = rooms.reduce((acc, room) => {
    if (!acc[room.section]) {
      acc[room.section] = [];
    }
    acc[room.section].push(room);
    return acc;
  }, {} as Record<string, Room[]>);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
          <span className="ml-3 text-gray-600">Loading rooms...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedRooms).map(([section, sectionRooms]) => (
        <div key={section} className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">{section}</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSectionColor(section)}`}>
              {section}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectionRooms.map((room) => (
              <div key={room.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-800">{room.room_name}</h4>
                    <p className="text-sm text-gray-600">{room.floor} Floor • {room.room_type}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                    {room.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Capacity: {room.capacity}</span>
                  <span>Library: {room.library}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
