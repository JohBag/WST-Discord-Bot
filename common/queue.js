export default class Queue {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.queue = [];
    }

    add(item) {
        if (this.queue.length === this.maxSize) {
            this.queue.shift();
        }
        this.queue.push(item);
    }

    size() {
        return this.queue.length;
    }

    clear() {
        this.queue = [];
    }

    getLast() {
        return this.queue[this.queue.length - 1];
    }

    getAll() {
        return this.queue;
    }
}