import fs from 'fs';

const FILE = './data/africa_leaders.json';

if (fs.existsSync(FILE)) {
  const leaders = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  let updatedCount = 0;

  const updatedLeaders = leaders.map(leader => {
    if (leader.status !== 'Activé') {
      updatedCount++;
      return { ...leader, status: 'Activé' };
    }
    return leader;
  });

  fs.writeFileSync(FILE, JSON.stringify(updatedLeaders, null, 2), 'utf-8');
  console.log(`✅ ${updatedCount} profils sur ${leaders.length} ont été mis à jour au statut "Activé" dans ${FILE} !`);
} else {
  console.error(`❌ Fichier ${FILE} introuvable.`);
}
