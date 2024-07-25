//FOUND ISSUE: EITHER NEED TO FIGURE OUT A WAY TO CONNECT THE HIGHWAYS TO MAIN ROADS OR DONT INCLUDE HIGHWAYS
//HIGHWAYS ARE NOT CONNECTED TO ROADS

//TODO: Optimize drawing the nodes->draw less of them



class Map{
    constructor(){
        this.nodes = {}
        this.ways = []
        this.graph = {}
        this.startNode = null
        this.endNode = null
    }
}

class Node{
    constructor(ref,lat,long){
        this.ref = ref
        this.lat = lat
        this.long = long
        this.xPos = 0
        this.yPos = 0
        this.distance = Infinity

    }
}

class Board{
    constructor(){
        this.container = document.getElementById('container')
        this.mapCanvas = document.getElementById('map-base')
        this.srcNodeCanvas = null
        this.dstNodeCanvas = null
    }
}

class Way{
    constructor(id){
        //linked list of nodes
        this.id = id
        this.nextNode = null
    }
}

class List{
    constructor(){
        this.head = null
    }
}

class Vertex{
    constructor(id){
        this.id = id
        this.weight = 0
    }
}

class Graph{
    constructor(){
        this.adjList = {}

    }
}


let ctxMap
let ctxSrc
let ctxDst
let leftBound = -112
let rightBound = -111.8
let topBound = 33.55
let bottomBound = 33.3255117
let width = 0
let height = 0
let mapInfo = new Map()
let mapBoard = new Board()
let mapDrawn = false
//let mapGraph = new Graph()

function drawInit(){
    //canvas = document.getElementById("map-base")
    //think of something better to do here
    mapBoard.mapCanvas.width = window.innerWidth
    mapBoard.mapCanvas.height = window.innerHeight
    //canvas.width = window.innerWidth
    //canvas.height = window.innerHeight
    width = window.innerWidth
    height = window.innerHeight
    if(mapBoard.mapCanvas.getContext){
        ctxMap = mapBoard.mapCanvas.getContext("2d")
    }
    fetchMapData(
        `(way[highway~"^(motorway|motorway_link|primary|secondary)$"]
    (${bottomBound},${leftBound},${topBound},${rightBound});
    );
    (
    ._;
    node(w)(${bottomBound},${leftBound},${topBound},${rightBound});
    );
    out;`
    ).then(mapData => {
        parseMapData(mapData)
        const nodeCount = Object.keys(mapInfo.nodes).length-1
        const randomInt = Math.floor(Math.random() * nodeCount)
        drawMap(mapInfo.nodes[Object.keys(mapInfo.nodes)[randomInt]])
        //mapDrawn = true
    })
    .catch(error => console.error("Fetch error:", error));
}

//have a graph/adjacency list and then have the lines span out as they draw, so it draws all touching edges at the current edge and then spreads like a virus

function fetchMapData(query) {
    const url = 'https://overpass-api.de/api/interpreter';
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
            'Accept': 'application/xml'
        },
        body: query
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        return response.text();
    });
}

function parseMapData(mapData){
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(mapData,"application/xml")
    parseNodes(xmlDoc)
    parseWays(xmlDoc)
}

function parseNodes(parsedDoc){
    const nodes = parsedDoc.getElementsByTagName("node")
    for(let i = 0; i < nodes.length; i++){
        const node = nodes[i]
        const id = node.getAttribute("id")
        const lat = node.getAttribute("lat")
        const long = node.getAttribute("lon")

        const tempNode = new Node(id,lat,long)
        mapInfo.nodes[id] = tempNode
    }
}

function parseWay(parsedDoc){
    const ways = parsedDoc.getElementsByTagName("way")
    for(let i = 0; i < ways.length; i++){
        const way = ways[i]
        const nodes = way.getElementsByTagName("nd")
        const tempNodeList = []
        for(let j = 0; j < nodes.length; j++){
            const node = nodes[j]
            tempNodeList.push(node.getAttribute('ref'))
        }
        mapInfo.ways.push(tempNodeList)
    }
}

function parseWays(parsedDoc){
    const ways = parsedDoc.getElementsByTagName("way")
    let index = 0
    for(let i = 0; i < ways.length; i++){
        const way = ways[i]
        const nodes = way.getElementsByTagName("nd")
        for(let j = 0; j < nodes.length-1; j++){
            const src = nodes[j]
            const dst = nodes[j+1]
            addEdge(src.getAttribute('ref'),dst.getAttribute('ref'),index)
            index += 1
        }
    }
}

function getNearestNode(event){  
    if(!mapDrawn){
        return
    }
    let screenX = event.clientX
    let screenY = event.clientY
    let {longitude:xPos,latitude:yPos} = convertToMapCoords(screenX,screenY,window.innerWidth,window.innerHeight)
    let minDist = Infinity
    let closestNode = null
    Object.values(mapInfo.nodes).forEach(node => {
        const dist = getDistance(xPos,yPos,node.long,node.lat)
        if(dist < minDist){
            minDist = dist
            closestNode = node
        }
    });
    let {screenX: x,screenY: y} = convertToScreenCoords(closestNode.lat,closestNode.long,width,height)
    drawCircle(x,y,10)
}

function convertToScreenCoords(lat,long,width,height){
    const screenY = height - ((lat - bottomBound) / (topBound - bottomBound)) * height
    const screenX = ((long - leftBound) / (rightBound - leftBound)) * width
    return {screenX,screenY}
}

function convertToMapCoords(xPos,yPos,width,height){
    const longitude = ((xPos/width)*(rightBound-leftBound))+leftBound
    const latitude = (((height-yPos)/height)*(topBound-bottomBound))+bottomBound
    return {longitude,latitude}
}

function drawPath(startNode,endNode){
    let delay = 100
    if(startNode && endNode){
        let {screenX: startX,screenY: startY} = convertToScreenCoords(startNode.lat,startNode.long,width,height)
        let {screenX: endX,screenY: endY} = convertToScreenCoords(endNode.lat,endNode.long,width,height)
        //draw the line
    setTimeout(() => {
        ctxMap.strokeStyle = 'white'
        ctxMap.lineWidth = 2
        ctxMap.beginPath()
        ctxMap.moveTo(startX,startY)
        ctxMap.lineTo(endX,endY)
        ctxMap.stroke()
        },delay)
    }
}


function drawCircle(xPos,yPos,radius){
    const newCanvas = document.createElement('canvas')
    newCanvas.id = "src-canvas"
    newCanvas.width = 15
    newCanvas.height = 15
    newCanvas.style.position = 'absolute'
    newCanvas.style.top = `${yPos-7.5}px`
    newCanvas.style.left = `${xPos-7.5}px`
    newCanvas.style.zIndex = '10'
    newCanvas.style.width = '15px'
    newCanvas.style.height = '15px'
    mapBoard.srcNodeCanvas = newCanvas
    mapBoard.container.appendChild(newCanvas)
    ctxSrc = newCanvas.getContext('2d')
    ctxSrc.beginPath()
    ctxSrc.fillStyle = 'red'
    ctxSrc.arc(7.5,7.5,radius,0,2*Math.PI)
    ctxSrc.fill()
}



function drawMaps(){
    let startKey = "3525611398"
    let startNode = mapInfo.nodes[startKey]
    let nodeList = []
    let drawnNodes = new Set()
    let drawnPaths = new Set()
    nodeList.push(startNode)
    drawnNodes.add(startNode.ref)
    while(nodeList.length > 0){
        startNode = nodeList.shift()
        let neighborNodes = mapInfo.graph[startNode.ref]
        for(let i = 0; i < neighborNodes.length; i++){
            let nextNode = neighborNodes[i].node
            if(!drawnNodes.has(nextNode.ref)){
                drawnNodes.add(nextNode.ref)
                nodeList.push(nextNode)
            }
            drawPath(startNode,nextNode)

        }
    }
}

function drawMap(startNode) {
    let drawnNodes = new Set();
    let drawnPaths = new Set();

    let nodeList = [];
    nodeList.push(startNode);
    drawnNodes.add(startNode.ref);
    while (nodeList.length > 0) {
        let currentNode = nodeList.shift();
        let neighborNodes = mapInfo.graph[currentNode.ref];
        for (let i = 0; i < neighborNodes.length; i++) {
            let nextNode = neighborNodes[i].node;
            let pathKey = `${currentNode.ref}-${nextNode.ref}`;
            let reversePathKey = `${nextNode.ref}-${currentNode.ref}`;
            if (!drawnPaths.has(pathKey) && !drawnPaths.has(reversePathKey)) {
                drawPath(currentNode, nextNode);
                drawnPaths.add(pathKey);
                drawnPaths.add(reversePathKey)
            }
            if (!drawnNodes.has(nextNode.ref)) {
                drawnNodes.add(nextNode.ref);
                nodeList.push(nextNode);
            }
        }
    }
    setTimeout(()=>{
        mapDrawn = true
    },100)
}
            


function getDistance(src,dst){
    let x = (src.long - dst.long) * (src.long - dst.long)
    let y = (src.lat - dst.lat) * (src.lat - dst.lat)
    return Math.sqrt(x + y)
}

function getDistance(srcX,srcY,dstX,dstY){
    let x = (srcX - dstX) * (srcX - dstX)
    let y = (srcY - dstY) * (srcY - dstY)
    return Math.sqrt(x + y)
}

function addEdge(startId,endId,key){
    let startNode = mapInfo.nodes[startId]
    let endNode = mapInfo.nodes[endId]

    if(!startNode || !endNode){
        return
    }
    let weight = getDistance(startNode.long,startNode.lat,endNode.long,endNode.lat)
    //let weight = getDistance(startNode,endNode)
    //startNode.weight = weight
    //endNode.weight = weight

    if(!mapInfo.graph[startId]){
        mapInfo.graph[startId] = []
    }  
    if(!mapInfo.graph[endId]){
        mapInfo.graph[endId] = []
    }
    
    mapInfo.graph[startId].push({node: endNode, weight: weight})
    mapInfo.graph[endId].push({node: startNode, weight: weight})
}


window.addEventListener("load",drawInit)
window.addEventListener("click",getNearestNode)
