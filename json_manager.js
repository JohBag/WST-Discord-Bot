export function load(fileName) {
    let rawdata = fs.readFileSync('json/' + fileName + '.json');
    return JSON.parse(rawdata);
}

export function save(fileName, data) {
    data = JSON.stringify(data);
    fs.writeFileSync('json/' + fileName + '.json', data);
}