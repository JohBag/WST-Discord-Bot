const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

exports.roll = function (min = 1, max = 100) {
    if (min < 0 || min > max || max > 1000000) {
        return -1;
    }
    return random(min, max);
}

function random(min, max) {
    return Math.floor(Math.random() * ((max + 1) - min)) + min;
}