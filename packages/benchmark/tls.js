const fs = require('node:fs');
const path = require('node:path');
const forge = require('node-forge');

const caPath = path.join(__dirname, 'tmp-cert.pem');
const keyPath = path.join(__dirname, 'tmp-key.pem');

if (!fs.existsSync(caPath) || !fs.existsSync(keyPath)) {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 10);
    cert.setSubject([ { name: 'commonName', value: 'localhost' } ]);
    cert.setIssuer([ { name: 'commonName', value: 'localhost' } ]);
    cert.setExtensions([ { name: 'basicConstraints', cA: true } ]);
    cert.sign(keys.privateKey);
    fs.writeFileSync(caPath, forge.pki.certificateToPem(cert));
    fs.writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey));
    fs.chmodSync(caPath, 0o777);
    fs.chmodSync(keyPath, 0o777);
}

exports.certificate = fs.readFileSync(caPath);
exports.privateKey = fs.readFileSync(keyPath);
