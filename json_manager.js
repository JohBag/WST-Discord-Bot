import fs from "fs";

export function load(fileName) {
    try {
        let rawdata = fs.readFileSync('json/' + fileName + '.json');
        return JSON.parse(rawdata);
    } catch (err) {
        console.log("File with name " + fileName + " not found");
        save(fileName, {});
        console.log("Created empty file");
        return {};
    }
}

export function save(fileName, data) {
    data = JSON.stringify(data);
    fs.writeFileSync('json/' + fileName + '.json', data);
}