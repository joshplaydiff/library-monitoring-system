const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const QR_OUTPUT_DIR = process.env.QR_OUTPUT_DIR || './qr_codes';

if (!fs.existsSync(QR_OUTPUT_DIR)) {
  fs.mkdirSync(QR_OUTPUT_DIR, { recursive: true });
}

const generateQR = async (data, filename) => {
  try {
    const qrData = typeof data === 'string' ? data : JSON.stringify(data);
    const outputPath = path.join(QR_OUTPUT_DIR, filename);

    await QRCode.toFile(outputPath, qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return outputPath;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

const generateQRDataURL = async (data) => {
  try {
    const qrData = typeof data === 'string' ? data : JSON.stringify(data);
    const url = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2
    });
    return url;
  } catch (error) {
    console.error('Error generating QR data URL:', error);
    throw new Error('Failed to generate QR code');
  }
};

const generateUserQR = async (user) => {
  // Stable QR payload: only id_type and official_id. No changing or unnecessary values.
  // If caller provides qr_payload, use it. Otherwise construct from user fields.
  let qrData;
  if (user.qr_payload) {
    qrData = user.qr_payload;
  } else {
    const officialIdentifier = user.official_id || user.student_id || String(user.id);
    qrData = {
      id_type: user.id_classification || user.user_type || 'student',
      official_id: officialIdentifier
    };
  }

  const filename = `user_${user.id}_${Date.now()}.png`;
  const qrPath = await generateQR(qrData, filename);

  const qrCodeData = {
    data: JSON.stringify(qrData),
    filename: filename,
    path: qrPath
  };

  return qrCodeData;
};

module.exports = {
  generateQR,
  generateQRDataURL,
  generateUserQR,
  QR_OUTPUT_DIR
};