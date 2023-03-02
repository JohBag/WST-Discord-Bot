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

    clear() {
        this.queue = [];
    }

    getAll() {
        return this.queue;
    }
}