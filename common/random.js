export default function roll(min = 1, max = 100) {
    return Math.floor(Math.random() * ((max + 1) - min)) + min;
}