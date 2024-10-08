import { MinHeap } from './heap.js'

//TODO: Optimize drawing the nodes->draw less of them
//Add a callback function for when the screen changes size so i can update the location of the src/dst node selections


/* TEST BOUND LAT/LON 
let leftBound = -112
let rightBound = -111.8
let topBound = 33.55
let bottomBound = 33.3255117
*/

class Map{
    constructor(){
        this.nodes = {}
        this.graph = {}
        this.startNode = null
        this.endNode = null
        this.startInfo = null
        this.endInfo = null
        //this array holds the references to all the pruned nodes and the nodes located after it in the way, so it can inherit the neighbors of the pruned node
        //after full parsing of the ways (to avoid loss of node dependencies)
        this.prunedNodes = []
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
        this.previous = null

    }
}

class Board{
    constructor(){
        this.container = document.getElementById('container')
        this.mapCanvas = document.getElementById('map-base')
        this.algoContainer = null
        this.srcNodeCanvas = null
        this.dstNodeCanvas = null
        this.srcInfoCanvas = null
        this.dstInfoCanvas = null
    }
}

let dragMap
let srcLock = false
let dstLock = false
let leftBound = -112
let rightBound = -111.8
let topBound = 33.55
let bottomBound = 33.3255117
let canvasWidth = 0
let canvasHeight = 0
let mapInfo = new Map()
let mapBoard = new Board()
let mapDrawn = false

/* 
Creates a draggable map and displays it
*/
function drawDragMap(){
    dragMap = L.map('map').setView([51.505,-0.09],13)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(dragMap);
}

/*
Get the latitude/longitude bounds based on the view range of the draggable map
*/
function lockLocation(){
    mapBoard.container.removeChild(document.getElementById('map'))
    const bounds = dragMap.getBounds()
    leftBound = bounds.getWest()
    rightBound = bounds.getEast()
    topBound = bounds.getNorth()
    bottomBound = bounds.getSouth()
    console.log(`${getDistance(leftBound,topBound,rightBound,bottomBound)}`)
    drawInit()
}

/*
Based on how far out the map is zoomed, query for smaller roads, such as secondary/tertiary roads

Return:
    query statement for way/node information
*/
function adjustZoomLevel(){
    const zoomLevel = getDistance(leftBound,topBound,rightBound,bottomBound)
    let statement
    statement = `(way[highway~"^(motorway|motorway_link|primary|secondary|trunk)$"]
    (${bottomBound},${leftBound},${topBound},${rightBound});
    );
    (
    ._;
    node(w)(${bottomBound},${leftBound},${topBound},${rightBound});
    );
    out;`
    return statement
}

/*
Initialize canvas settings, query road details, and draw the map
*/
function drawInit(){
    let mapCanvas = document.createElement('canvas')
    mapCanvas.id = 'map-base'
    mapCanvas.width = window.innerWidth
    mapCanvas.height = window.innerHeight
    mapBoard.container.appendChild(mapCanvas)
    mapBoard.mapCanvas = mapCanvas
    canvasWidth = window.innerWidth
    canvasHeight = window.innerHeight
    const fetchStatement = adjustZoomLevel()
    fetchMapData(
                fetchStatement
    ).then(mapData => {
        parseMapData(mapData)
        const nodeCount = Object.keys(mapInfo.nodes).length-1
        const randomInt = Math.floor(Math.random() * nodeCount)
        drawMap(mapInfo.nodes[Object.keys(mapInfo.nodes)[randomInt]])
    })
    .catch(error => console.error("Fetch error:", error));
}

/*
Uses the turbo overpass API to query for road/highway information between some bounding box

Args:
    query -> string

Return:
    way and node information for an area -> XML
*/
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

/*
Uses the nominatim API to get the street information (City, Country, Street Name, etc.) for a specific lat/lon

Args:
    lat -> float
    lon -> float

Return:
    List of identifying information for a specific latitude/longitude -> XML
*/
function fetchAreaDetails(lat,lon){
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}`
    return fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/xml'
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        return response.text();
    });
}

/*
Parse the nodes and ways to be able to store it in a graph data structure

Args:
    mapData -> XML
*/
function parseMapData(mapData){
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(mapData,"application/xml")
    parseNodes(xmlDoc)
    parseWays(xmlDoc)
}

/*
Gets a list of all of the nodes that the map/ways consist of

Args:
    parsedDoc -> XML Dcoument
*/
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
    //console.log(Object.keys(mapInfo.nodes).length)
}

/*
Gets all of the ways and the nodes in it to create an undirected adjacency list. The graph will hold the road information

Args:
    parsedDoc -> XML Document
*/
function parseWays(parsedDoc){
    const ways = parsedDoc.getElementsByTagName("way")
    let index = 0
    let total = 0
    for(let i = 0; i < ways.length; i++){
        const way = ways[i]
        let nodes = way.getElementsByTagName("nd")
        nodes = Array.from(nodes)
        total += nodes.length
        //delete this \/
        for(let k = 0; k < nodes.length; k++){
            const temp = nodes[k].getAttribute('ref')
            if(!mapInfo.nodes[temp])
                nodes.splice(k,1)
        }
        //execute the douglas-pecker algorithm here
        //const prunedNodes = douglasPeucker(nodes,0.001)
        //douglasPeucker(nodes,0.0001)
        //try having a function that inherits the neighbors from the other node
        for(let j = 0; j < nodes.length-1; j++){
            const src = nodes[j]
            const dst = nodes[j+1]
            addEdge(src.getAttribute('ref'),dst.getAttribute('ref'),index)
            index += 1
        }
    }
    //optimizeGraph()
}

/*
Gets the details of a specific location that meets a list of accepted tags

Args:
    locationData -> XML Document

Return:
    an object containing information about some location (lat/lon) -> Object
*/
function parseDetails(locationData){
    const acceptableTags = ["city","state","country","county","suburb","road","postcode","postcode","town","village","state_district"]
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(locationData,"application/xml")
    const locationObj = {}
    const addy = xmlDoc.getElementsByTagName("addressparts")
    if(addy.length > 0){
        const addyChildren = addy[0].children
        for(let i = 0; i < addyChildren.length; i++){
        if(acceptableTags.includes(addyChildren[i].tagName)){
            locationObj[addyChildren[i].tagName] = addyChildren[i].textContent
        }
        }
    }
    return locationObj
}

/*
Once a node is selected on the map, when the user mouses over it this function will display information about the node

Args:
    canvas -> HTMLCanvasElement
    textObj -> Object

Return:
    updated canvas element with modified tags -> HTMLCanvasElement
*/
function addTextToCanvas(canvas,textObj){
    const ctx = canvas.getContext('2d')
    const fontSize = 20
    ctx.font = `${fontSize}px Impact`

    let textString = ""
    Object.entries(textObj).forEach(([key,value]) => {
        textString += key[0].toUpperCase() + key.slice(1,key.length) + ": " + value + "\n"
    })

    const lines = textString.split('\n')

    let maxWidth = 0
    lines.forEach(line =>{
        const widthMetric = ctx.measureText(line)
        if(widthMetric.width > maxWidth){
            maxWidth = widthMetric.width
        }
    })

    const textWidth = maxWidth + 20
    const textHeight = lines.length * fontSize

    canvas.width = textWidth
    canvas.height = textHeight
    canvas.style.width = `${canvas.width}px`
    canvas.style.height = `${canvas.height}px`

    ctx.font = `${fontSize}px Impact`
    ctx.fillStyle = 'white'
    lines.forEach((line,index) => {
        ctx.fillText(line,10,fontSize * (index+1))
    })

    return canvas


}

//for the display nodes, after the map algo is ran i want the node info to be displayed for both nodes and the distance of travel
function displayNodeDetails(displayNode,nodeInfo,canvas){
    let {screenX: x,screenY: y} = convertToScreenCoords(displayNode.lat,displayNode.long,window.innerWidth,window.innerHeight)

    //const canvasWidth = 100
    //const canvasHeight = 100
    let newCanvas = document.createElement('canvas')
    newCanvas.id = `info-canvas`
    newCanvas.classList.add('info-canvas')
    newCanvas = addTextToCanvas(newCanvas,nodeInfo)

    //TODO: change so it will put this farthest away from the opposing node to not cover up the shortest path (unless it would go off screen)   
    if(window.innerWidth - x < window.innerWidth / 2){
        newCanvas.style.left = `${x-newCanvas.width-5}px`
    }
    else{
        newCanvas.style.left = `${x}px`
    }
    if(window.innerHeight - y < window.innerHeight / 2){
        newCanvas.style.top = `${y-newCanvas.height-5}px`
    }
    else{
        newCanvas.style.top = `${y}px`
    }
    //newCanvas.style.left = `${x}px`
    //newCanvas.style.backgroundColor = 'red'
    //newCanvas = addTextToCanvas(newCanvas,mapInfo.startInfo)
    //newCanvas.style.top = `${window.innerHeight/2}px`
    //newCanvas.style.left = `${window.innerWidth/2}px`
    mapBoard.container.appendChild(newCanvas)
    if(canvas === mapBoard.srcNodeCanvas){
        mapBoard.srcInfoCanvas = newCanvas
    }
    else{
        mapBoard.dstInfoCanvas = newCanvas
    }
}

/*
After the node is no longer being hovered over, delete the canvas to remove the information

Args:
    canvas -> HTMLCanvasElement
*/
function killNodeDetails(canvas){
    if(canvas){
        mapBoard.container.removeChild(canvas)
    }
    else{
        return
    }
    if(canvas === mapBoard.srcInfoCanvas){
        mapBoard.srcInfoCanvas = null
    }
    else{
        mapBoard.dstInfoCanvas = null
    }
}

/*
Add certain properties to a canvas element

Args:
    xPos -> float
    yPos -> float
    canvas -> HTMLCanvasElement
*/
function defineCanvasProps(xPos,yPos,canvas){
    canvas.classList.add('point-canvas')
    canvas.width = 15
    canvas.height = 15
    canvas.style.position = 'absolute'
    canvas.style.top = `${yPos-7.5}px`
    canvas.style.left = `${xPos-7.5}px`
    canvas.style.zIndex = '11'
    canvas.style.width = '15px'
    canvas.style.height = '15px'
    canvas.setAttribute("draggable",true)
}

/*
Creates a new canvas and adds to the container for ease of removal of added content

Return:
    the canvas element with updated properties -> HTMLCanvasElement
*/
function createCanvas(){
    const newCanvas = document.createElement('canvas')
    newCanvas.id = `algo-canvas`
    newCanvas.classList.add('algo-canvas')
    newCanvas.width = window.innerWidth
    newCanvas.height = window.innerHeight
    mapBoard.algoContainer.appendChild(newCanvas)
    return newCanvas
}

/*
Creates the div for map
*/
function generatePlane(){
    const newDiv = document.createElement('div')
    newDiv.id = 'algo-div'
    mapBoard.algoContainer = newDiv
    mapBoard.container.appendChild(newDiv)
}

/*
Takes a canvas representing some node and updates it position on the screen

Args:
    xPos -> float
    yPos -> float
    canvas -> HTMLCanvasElement
*/
function moveNode(xPos,yPos,canvas){
    canvas.style.top = `${yPos-7.5}px`
    canvas.style.left = `${xPos-7.5}px`
}

/*
Adds a drag handler for the start/end point canvases for drag capability

Args:
    canvas -> HTMLCanvasElement
*/
function setDragHandler(canvas){
    canvas.addEventListener("drag",(event)=>{
        const mouseX = event.clientX
        const mouseY = event.clientY
        moveNode(mouseX,mouseY,canvas)
    })
}

/*
Once the node canvas is released we want to find the node in the graph closest to the position of the canvas on the screen and lock the canvas onto that position

Args:
    canvas -> HTMLCanvasElement
*/
function setDragEndHandler(canvas){
    canvas.addEventListener("dragend",(event)=>{
        const mouseX = event.clientX
        const mouseY = event.clientY
        let {longitude:xPos,latitude:yPos} = convertToMapCoords(mouseX,mouseY,window.innerWidth,window.innerHeight)
        
        let minDist = Infinity
        let closestNode = null
        Object.values(mapInfo.nodes).forEach(node => {
            const dist = getDistance(xPos,yPos,node.long,node.lat)
            if(dist < minDist){
                minDist = dist
                closestNode = node
            }
        });
        //used to be type === 'src
        if(canvas === mapBoard.srcNodeCanvas){
            mapInfo.startNode = closestNode
            fetchAreaDetails(mapInfo.startNode.lat,mapInfo.startNode.long
            ).then(locationDetails =>{
                mapInfo.startInfo = parseDetails(locationDetails)
                })
        }
        else{
            mapInfo.endNode = closestNode
            fetchAreaDetails(mapInfo.endNode.lat,mapInfo.endNode.long
            ).then(locationDetails =>{
                mapInfo.endInfo = parseDetails(locationDetails)
                })
        }
        let {screenX: x,screenY: y} = convertToScreenCoords(closestNode.lat,closestNode.long,window.innerWidth,window.innerHeight)
        moveNode(x,y,canvas)
        
    })
}

/*
Add the handlers to the node canvas

Args:
    getNode -> getter function for node
    getInfo -> getter function for node information
    getNodeCanvas -> getter function for node canvas
    getInfoCanvas -> getter function for info canvas
*/
function setNodeInfoHandler(getNode,getInfo,getNodeCanvas,getInfoCanvas){
    const nodeCanvas = getNodeCanvas()    
    nodeCanvas.addEventListener("mouseover", (event) =>{
        displayNodeDetails(getNode(),getInfo(),nodeCanvas)
    })
    nodeCanvas.addEventListener("mouseout",(event) => {
        killNodeDetails(getInfoCanvas())
    })
}

/*
Gets the closest node on the graph to the mouse position of the user's click

Args:
    event -> MouseEvent
*/
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
    let {screenX: x,screenY: y} = convertToScreenCoords(closestNode.lat,closestNode.long,window.innerWidth,window.innerHeight)
    if(!srcLock){
        generatePlane()
        mapInfo.startNode = closestNode
        const newCanvas = document.createElement('canvas')
        newCanvas.id = "src-canvas"
        defineCanvasProps(x,y,newCanvas)
        mapBoard.srcNodeCanvas = newCanvas
        mapBoard.algoContainer.appendChild(newCanvas)
        drawCircle(5,newCanvas)
        srcLock = true
        setDragHandler(mapBoard.srcNodeCanvas)
        setDragEndHandler(mapBoard.srcNodeCanvas)
        fetchAreaDetails(mapInfo.startNode.lat,mapInfo.startNode.long
        ).then(locationDetails =>{
            mapInfo.startInfo = parseDetails(locationDetails)
            setNodeInfoHandler(() => mapInfo.startNode,() => mapInfo.startInfo,() => mapBoard.srcNodeCanvas,()=>mapBoard.srcInfoCanvas)
    })
    }
    else if(!dstLock){
        mapInfo.endNode = closestNode
        const newCanvas = document.createElement('canvas')
        newCanvas.id = "dst-canvas"
        defineCanvasProps(x,y,newCanvas)
        mapBoard.dstNodeCanvas = newCanvas
        mapBoard.algoContainer.appendChild(newCanvas)
        drawCircle(5,newCanvas)
        dstLock = true
        setDragHandler(mapBoard.dstNodeCanvas)
        setDragEndHandler(mapBoard.dstNodeCanvas)
        fetchAreaDetails(mapInfo.endNode.lat,mapInfo.endNode.long
        ).then(locationDetails =>{
            mapInfo.endInfo = parseDetails(locationDetails)
            setNodeInfoHandler(() => mapInfo.endNode,() => mapInfo.endInfo,() => mapBoard.dstNodeCanvas,()=>mapBoard.dstInfoCanvas)
    })
    }
    else{
        mapBoard.container.removeChild(mapBoard.algoContainer)
        srcLock = false
        dstLock = false
    }
}

/*
Converts latitude/longitude to coordinates that will fit on the screen

Args:
    lat -> float
    long -> float
    width -> float
    height -> float

Return:
    lat/lon coordinates in screen space -> object
*/
function convertToScreenCoords(lat,long,width,height){
    const screenY = height - ((lat - bottomBound) / (topBound - bottomBound)) * height
    const screenX = ((long - leftBound) / (rightBound - leftBound)) * width
    return {screenX,screenY}
}

/*
Converts screen coordinates to lat/lon coordinates

Args:
    xPos -> float
    yPos -> float
    width -> float
    height -> float

Return:
    lat/lon coordinates -> object
*/
function convertToMapCoords(xPos,yPos,width,height){
    const longitude = ((xPos/width)*(rightBound-leftBound))+leftBound
    const latitude = (((height-yPos)/height)*(topBound-bottomBound))+bottomBound
    return {longitude,latitude}
}

/*
Draws a line between two nodes connecting them symbolizing a rode

Args:
    canvas -> HTMLCanvasElement
    startNode -> Node object
    endNode -> Node object
    color -> string
    delay -> float
*/
function drawPath(canvas,startNode,endNode,color,delay){
    const ctx = canvas.getContext('2d')
    if(startNode && endNode){
        let {screenX: startX,screenY: startY} = convertToScreenCoords(startNode.lat,startNode.long,canvasWidth,canvasHeight)
        let {screenX: endX,screenY: endY} = convertToScreenCoords(endNode.lat,endNode.long,canvasWidth,canvasHeight)
        //draw the line
    setTimeout(() => {
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(startX,startY)
        ctx.lineTo(endX,endY)
        ctx.stroke()
        },delay)
    }
}

/*
Draw a circle on the screen

Args:
    radius -> float
    canvas -> HTMLCanvasElement
*/
function drawCircle(radius,canvas){
    const ctxCircle = canvas.getContext('2d')
    ctxCircle.beginPath()
    ctxCircle.fillStyle = 'red'
    ctxCircle.arc(7.5,7.5,radius,0,2*Math.PI)
    ctxCircle.fill()

    ctxCircle.lineWidth = 0.5
    ctxCircle.strokeStyle = 'white'
    ctxCircle.stroke()
}

/*
Draws lines between each connected node drawing a grid of interconnecting roads

Args:
    startNode -> Node Object
*/
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
                drawPath(mapBoard.mapCanvas,currentNode, nextNode,'white',100)
                drawnPaths.add(pathKey);
                drawnPaths.add(reversePathKey)
            }
            if (!drawnNodes.has(nextNode.ref)) {
                drawnNodes.add(nextNode.ref);
                nodeList.push(nextNode);
            }
        }
    }
    console.log("ole")
    setTimeout(()=>{
        mapDrawn = true
    },100)
}
            
/*
Calculate the Euclidean distance between two points

Args:
    srcX -> float
    srcY -> float
    dstX -> float
    dstY -> float

Return:
    distance between two points -> float
*/
function getDistance(srcX,srcY,dstX,dstY){
    let x = (srcX - dstX) * (srcX - dstX)
    let y = (srcY - dstY) * (srcY - dstY)
    return Math.sqrt(x + y)
}

/*
Gets a random integer between a minimum and a maximum

Args:
    min -> int
    max -> int

Return:
    random int between min and max inclusive -> int
*/
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/*
Adds an edge in the graph to some node and its corresponding edge node

Args:
    startId -> string
    endId -> string
*/
function addEdge(startId,endId){
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

/*
Initializes the nodes distances for A* algorithm
*/
function initializeDistances(){
    Object.values(mapInfo.nodes).forEach(node =>{
        node.distance = Infinity
        node.previous = null
    })
}

/*
After we have determined the shortest path using A*, we work backwards from the end node to the start node and
draw a red path between each node in the path we found

Args:
    canvas -> HTMLCanvasElement
*/
function drawShortestPath(canvas){
    const ctx = canvas.getContext('2d')
    let path = []
    let node = mapInfo.endNode
    while(node){
        path.push(node)
        node = mapInfo.nodes[node.previous]
    }
    path.reverse()
    for(let i = 0; i < path.length-1; i++){
        drawPath(canvas,path[i],path[i+1],'red',100)
    }

}

/*
A* shortest path algorithm that uses Euclidean distance as the heuristic which will skew the search for nodes towards
the destination versus dijkstras which will check every node

Args:
    startNode -> Node Object
    endNode -> Node Object
*/
function aStar(startNode,endNode){
    //A* heuristic - Euclidean Distance
    function potential(node){
        return getDistance(node.long,node.lat,endNode.long,endNode.lat)
    }

    //Sets all of the distances of the nodes to Infinity
    initializeDistances()
    //Priority Queue: keeping track of the shortest next node for shortest path algorithm
    //Visited Set:  to ensure avoidance of repeated visiting of nodes for optimization
    const queue = new MinHeap()
    const visited = new Set()
    const algoCanvas = createCanvas()

    mapInfo.nodes[startNode.ref].distance = 0
    queue.add(mapInfo.nodes[startNode.ref])
    while(queue.heap.length > 0){
        const current = queue.remove()
        visited.add(current.ref)
        if(current.ref === endNode.ref){
            break
        }
        const neighbors = mapInfo.graph[current.ref]
        for(let i = 0; i < neighbors.length; i++){
            const neighbor = mapInfo.nodes[neighbors[i].node.ref]
            const newDist = current.distance + neighbors[i].weight
            if(visited.has(neighbor.ref)){
                continue
            }
            if(neighbor.distance > newDist){
                neighbor.distance = newDist
                neighbor.previous = current.ref
                queue.update(neighbor,newDist + potential(neighbor))
            } 
            drawPath(algoCanvas,current,neighbor,`rgb(${85},${85},${85})`,100)
            //neighbor.previous = current.ref
        }
    }
    drawShortestPath(algoCanvas)
}

/*
Weighted sum of the components of two 2D vectors

Args:
    v -> array of floats (vector)
    w -> array of floats (vector)

Return:
    dot product -> float
*/
function dotProduct(v,w){
    return v[0]*w[0] + v[1]*w[1]
}

/*
Gets the perpendicular distance of two points to some line

Args:
    v -> array of floats (vector)
    node -> Node Object
    start -> Node Object

Return: 
    orthogonal distance -> float
*/
function orthogonalDistance(v,node,start){
    const wX = node.long - start.long
    const wY = node.lat - start.lat
    let w = [wX,wY]
    const t = (dotProduct(v,w) / (dotProduct(v,v)))
    const cX = Number(node.long) + (t * v[0])
    const cY = Number(node.lat) + (t * v[1])
    return getDistance(Number(node.long),Number(node.lat),cX,cY)
}

/*
Algorithm to reduce the amount of nodes on some node collection while maintaining the geometry the nodes create together

Args:
    nodes -> array of nodes
    epsilon -> float
*/
function douglasPeucker(nodes, epsilon){
    //console.log(mapInfo.nodes["5742573759"])
    if(nodes.length < 3){
        //return nodes
        return
    }
    let startNode = mapInfo.nodes[nodes[0].getAttribute('ref')]
    let endNode = mapInfo.nodes[nodes[nodes.length-1].getAttribute('ref')]
   
    if(!startNode || !endNode){
        //return nodes
        return
    }
    const vX = endNode.long - startNode.long
    const vY = endNode.lat - startNode.lat
    let v = [vX,vY]
    let tempNodes = Array.from(nodes)
    while(true){
        let maxD = 0
        let prunedIndex = -1
        for(let x = 1; x < tempNodes.length-1; x++){
            const node = mapInfo.nodes[tempNodes[x].getAttribute('ref')]
            //distance function
            const dist = orthogonalDistance(v,node,startNode)
            if(dist > maxD && dist > epsilon){
                maxD = dist
                prunedIndex = x
            }
        }
        if(prunedIndex === -1 || maxD <= epsilon){
            break
        }
        else{
            //Add a potential node to be removed for later processing
            tempNodes.splice(prunedIndex,1)
            const prunedNode = nodes[prunedIndex].getAttribute('ref')
            const nextNode = nodes[prunedIndex+1].getAttribute('ref')
            const prevNode = nodes[prunedIndex-1].getAttribute('ref')
            mapInfo.prunedNodes.push([prunedNode,prevNode,nextNode])

        }
    }
    //return nodes

}

/*
Deletes a two-way connection of some edge

Args:
    prunedRef -> string
    modifyRef -> string
*/
function removeEdge(prunedRef,modifyRef){
    const neighbors = mapInfo.graph[modifyRef]
    for(let i = 0; i < neighbors.length; i++){
        if(neighbors[i].node.ref === prunedRef){
            mapInfo.graph[modifyRef].splice(i,1)
        }
    }
}

//prunedNodes -> [prunedNode,prevNode,nextNode]

function optimizeGraph(){
    const prunedQueue = mapInfo.prunedNodes
    for(let i = 0; i < prunedQueue.length; i++){
        const prunedRef = prunedQueue[i][0]
        const prevRef = prunedQueue[i][1]
        const nextRef = prunedQueue[i][2]

        if(!mapInfo.graph[prunedRef]) continue

        const neighbors = mapInfo.graph[prunedRef]
        if(neighbors.length > 2){
            continue
        }
        //otherwise we are cleared for removal since there are no other neighbors to account for
        addEdge(prevRef,nextRef)
        removeEdge(prunedRef,prevRef)
        removeEdge(prunedRef,nextRef)
        //removeEdge(prevRef,prunedRef)
        //removeEdge(nextRef,prunedRef)
        //delete mapInfo.graph[prunedRef]
        //delete mapInfo.nodes[prunedRef]
    }
}


function optimizedGraph(){
    const prunedQueue = mapInfo.prunedNodes
    for(let i = 0; i < prunedQueue.length; i++){
        const prunedRef = prunedQueue[i][0]
        const inheritRef = prunedQueue[i][1]
        const neighbors = mapInfo.graph[prunedRef]
        for(let j = 0; j < neighbors.length; j++){
            removeEdge(prunedRef,neighbors[j].node.ref)
            addEdge(inheritRef,neighbors[j].node.ref)
            
        }
        //mapInfo.graph[prunedRef].length = 0
        delete mapInfo.graph[prunedRef]
    }
}






window.addEventListener("load",drawDragMap)
window.addEventListener("click",getNearestNode)
window.addEventListener("keydown",(event) =>{
    switch(event.key){
        //lock selected nodes in place
        case "Enter":
            if(srcLock && dstLock){
                aStar(mapInfo.startNode,mapInfo.endNode)
                //TODO:
                //remove mouse over events
                //display the nodes info indefinitely without covering the shortest path
            }
            break
        //TODO: Case R: restart the map fresh
        case "r":
            lockLocation()
            break
    }
})
window.addEventListener("resize",(event)=>{
    canvasHeight = window.innerHeight
    canvasWidth = window.innerWidth
    let {screenX: startX,screenY: startY} = convertToScreenCoords(mapInfo.startNode.lat,mapInfo.startNode.long,window.innerWidth,window.innerHeight)
    let {screenX: endX,screenY: endY} = convertToScreenCoords(mapInfo.endNode.lat,mapInfo.endNode.long,window.innerWidth,window.innerHeight)
    moveNode(startX,startY,mapBoard.srcNodeCanvas)
    moveNode(endX,endY,mapBoard.dstNodeCanvas)
})

