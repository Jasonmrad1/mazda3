import fs from 'node:fs';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
for(const group of ['dependencies','devDependencies'])for(const key of Object.keys(pkg[group]))pkg[group][key]='^'+lock.packages['node_modules/'+key].version;
pkg.devDependencies.prettier='^3.6.2';
pkg.overrides={glob:'^14.0.3'};
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
