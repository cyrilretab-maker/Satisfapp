// Fabrique les icônes provisoires de l'app (un anneau gris sur fond sombre, comme une vue d'endoscope).
// Lancement : npm run icones   — écrit public/icones/icone-192.png et icone-512.png
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloc(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const typeEtDonnees = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeEtDonnees));
  return Buffer.concat([longueur, typeEtDonnees, crc]);
}

function icone(taille) {
  const lignes = [];
  const centre = taille / 2;
  for (let y = 0; y < taille; y++) {
    const ligne = Buffer.alloc(1 + taille * 3); // 1 octet de filtre + RGB
    for (let x = 0; x < taille; x++) {
      const d = Math.hypot(x + 0.5 - centre, y + 0.5 - centre) / taille;
      let v = 30; // fond sombre
      if (d < 0.3) v = Math.round(110 + 60 * (1 - d / 0.3)); // disque clair au centre
      else if (d < 0.34) v = 70; // bord de la vue
      const i = 1 + x * 3;
      ligne[i] = v;
      ligne[i + 1] = v;
      ligne[i + 2] = v;
    }
    lignes.push(ligne);
  }
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(taille, 0);
  entete.writeUInt32BE(taille, 4);
  entete[8] = 8; // 8 bits par canal
  entete[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(Buffer.concat(lignes))),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icones', { recursive: true });
for (const taille of [192, 512]) writeFileSync(`public/icones/icone-${taille}.png`, icone(taille));
console.log('Icônes écrites dans public/icones');
