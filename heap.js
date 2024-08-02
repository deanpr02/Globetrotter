export class MinHeap {
    constructor() {
        this.heap = [];
    }
 
    // Helper Methods
    getLeftChildIndex(parentIndex) {
        return 2 * parentIndex + 1;
    }
    getRightChildIndex(parentIndex) {
        return 2 * parentIndex + 2;
    }
    getParentIndex(childIndex) {
        return Math.floor((childIndex - 1) / 2);
    }
    hasLeftChild(index) {
        return this.getLeftChildIndex(index) < this.heap.length;
    }
    hasRightChild(index) {
        return this.getRightChildIndex(index) < this.heap.length;
    }
    hasParent(index) {
        return this.getParentIndex(index) >= 0;
    }
    leftChild(index) {
        return this.heap[this.getLeftChildIndex(index)];
    }
    rightChild(index) {
        return this.heap[this.getRightChildIndex(index)];
    }
    parent(index) {
        return this.heap[this.getParentIndex(index)];
    }
 
    // Functions to create Min Heap
     
    swap(indexOne, indexTwo) {
        const temp = this.heap[indexOne];
        this.heap[indexOne] = this.heap[indexTwo];
        this.heap[indexTwo] = temp;
    }
 
    peek() {
        if (this.heap.length === 0) {
            return null;
        }
        return this.heap[0];
    }
     
    // Removing an element will remove the
    // top element with highest priority then
    // heapifyDown will be called 
    remove() {
        if (this.heap.length === 0) {
            return null;
        }
        const item = this.heap[0][0];
        this.heap[0] = this.heap[this.heap.length - 1];
        this.heap.pop();
        this.heapify(0);
        return item;
    }
 
    add(item,weight) {
        this.heap.push([item,weight]);
        this.heapify(0);
    }

    update(item,weight){
        for(let i = 0; i < this.heap.length; i++){
            if(this.heap[i][0] === item.ref){
                this.heap[i][1] = weight
                this.heapify(i)
                return
            }
        }
        this.add(item,weight)
    }
 

    heapify(i){
    let smallest = i; // Initialize largest as root
    let l = 2 * i + 1; // left = 2*i + 1
    let r = 2 * i + 2; // right = 2*i + 2
 
    // If left child is larger than root
    if (l < this.heap.length && this.heap[l][1] < this.heap[smallest][1]){
        smallest = l;
    }
 
    // If right child is larger than largest so far
    if (r < this.heap.length && this.heap[r][1] < this.heap[smallest][1]){
        smallest = r;
    }
 
    // If largest is not root
    if (smallest != i) {
        this.swap(i, smallest);
 
        // Recursively heapify the affected sub-tree
        this.heapify(smallest);
    }
    }
     
    printHeap() {
        var heap =` ${this.heap[0]} `
        for(var i = 1; i<this.heap.length;i++) {
            heap += ` ${this.heap[i]} `;
        }
        console.log(heap);
    }
}