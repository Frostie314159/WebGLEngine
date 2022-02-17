"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-ignore
const { vec2, vec3, vec4, mat2, mat3, mat4 } = glMatrix;
class Program {
    shaders;
    program;
    start(gl) {
        gl.useProgram(this.program);
    }
    stop(gl) {
        gl.useProgram(null);
    }
    loadDataToUniform(gl, location, data, forceFloat = false) {
        if (typeof data === "number") {
            if (data % 1 === 0 && !forceFloat) {
                if (data < 0) {
                    gl.uniform1ui(location, data);
                }
                else {
                    gl.uniform1i(location, data);
                }
            }
            else {
                gl.uniform1f(location, data);
            }
        }
        else if (typeof data === "boolean") {
            gl.uniform1i(location, data ? 1 : 0);
        }
        else if (data.length === 2) {
            gl.uniform2fv(location, data);
        }
        else if (data.length === 3) {
            gl.uniform3fv(location, data);
        }
        else if (data.length === 4) {
            gl.uniform4fv(location, data);
        }
        else if (data.length === 16) {
            gl.uniformMatrix4fv(location, false, data);
        }
    }
    getUniformLocation(gl, name) {
        return gl.getUniformLocation(this.program, name);
    }
    delete(gl) {
        gl.deleteProgram(this.program);
    }
    static detectShaderType(name) {
        return name.includes(".vert") ? WebGL2RenderingContext.VERTEX_SHADER : WebGL2RenderingContext.FRAGMENT_SHADER;
    }
    static async loadShader(gl, name) {
        return new Promise(async (resolve, reject) => {
            var shader = gl.createShader(this.detectShaderType(name));
            gl.shaderSource(shader, `#version 300 es
            ${await loadFile(`res/shaders/${name}`)}`);
            gl.compileShader(shader);
            if (gl.getShaderParameter(shader, WebGL2RenderingContext.COMPILE_STATUS)) {
                resolve(shader);
            }
            else {
                let shaderInfoLog = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                reject(new Error(shaderInfoLog));
            }
        });
    }
    static async loadProgram(gl, name) {
        return new Promise(async (resolve, reject) => {
            var program = new Program();
            program.program = gl.createProgram();
            program.shaders = await Promise.all([Program.loadShader(gl, `${name}.vert`), Program.loadShader(gl, `${name}.frag`)]);
            program.shaders.forEach((currentShader) => {
                gl.attachShader(program.program, currentShader);
            });
            gl.linkProgram(program.program);
            if (gl.getProgramParameter(program.program, WebGL2RenderingContext.LINK_STATUS)) {
                resolve(program);
            }
            else {
                let programInfoLog = gl.getProgramInfoLog(program.program);
                program.delete(gl);
                reject(new Error(programInfoLog));
            }
        });
    }
}
class VBOData {
    data;
    dataLength;
    attribLocation;
    elementSize;
    elementType;
    isIndexBuffer;
    constructor(gl, data, program, attribLocationName, elementSize, elementType, isIndexBuffer = false) {
        this.data = data;
        this.dataLength = data.length;
        this.attribLocation = gl.getAttribLocation(program.program, attribLocationName);
        this.elementSize = elementSize;
        this.elementType = elementType;
        this.isIndexBuffer = isIndexBuffer;
    }
}
class VBO {
    vboData;
    vbo;
    bindVBO(gl) {
        gl.bindBuffer((this.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), this.vbo);
    }
    unbindVBO(gl) {
        gl.bindBuffer((this.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), null);
    }
    enableVBO(gl) {
        if (this.vboData.isIndexBuffer) {
            this.bindVBO(gl);
        }
        else {
            gl.enableVertexAttribArray(this.vboData.attribLocation);
        }
    }
    disableVBO(gl) {
        if (this.vboData.isIndexBuffer) {
            this.unbindVBO(gl);
        }
        else {
            gl.disableVertexAttribArray(this.vboData.attribLocation);
        }
    }
    delete(gl) {
        gl.deleteBuffer(this.vbo);
    }
    static async loadVBOFromArray(gl, vboData) {
        return new Promise((resolve) => {
            var vbo = new VBO();
            vbo.vbo = gl.createBuffer();
            vbo.vboData = vboData;
            vbo.bindVBO(gl);
            gl.bufferData((vbo.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), vboData.data, WebGL2RenderingContext.STATIC_DRAW);
            if (!vbo.vboData.isIndexBuffer) {
                gl.enableVertexAttribArray(vboData.attribLocation);
                gl.vertexAttribPointer(vboData.attribLocation, vboData.elementSize, vboData.elementType, false, 0, 0);
                gl.disableVertexAttribArray(vboData.attribLocation);
            }
            vbo.vboData.data = undefined;
            vbo.unbindVBO(gl);
            resolve(vbo);
        });
    }
}
class VAO {
    vbos;
    vao;
    length;
    containsIndexBuffer;
    static vaos = [];
    bindVAO(gl) {
        gl.bindVertexArray(this.vao);
    }
    unbindVAO(gl) {
        gl.bindVertexArray(null);
    }
    enableVAO(gl) {
        this.bindVAO(gl);
        this.vbos.forEach((currentVBO) => {
            currentVBO.enableVBO(gl);
        });
    }
    disableVAO(gl) {
        this.vbos.reverse().forEach((currentVBO) => {
            currentVBO.disableVBO(gl);
        });
        this.unbindVAO(gl);
    }
    delete(gl) {
        this.vbos.reverse().forEach((currentVBO) => {
            currentVBO.delete(gl);
        });
        gl.deleteVertexArray(this.vao);
    }
    static getVAO(vaoID) {
        return VAO.vaos[vaoID];
    }
    static async loadVAOFromOBJFile(gl, program, objName) {
        return new Promise(async (resolve) => {
            class Vertex {
                position;
                normal;
                textureCord;
                constructor(position, normal, textureCord) {
                    this.position = position;
                    this.normal = normal;
                    this.textureCord = textureCord;
                }
            }
            var vertices = [];
            var normals = [];
            var textureCords = [];
            var indices = [];
            var assembledVertices = [];
            var vertexArray;
            var normalArray;
            var textureCordArray;
            var objFileContents = await loadFile(`res/assets/${objName}`);
            function processVertex(vertex) {
                let currentVertexPointer = Number.parseInt(vertex[0]) - 1;
                indices.push(currentVertexPointer);
                let currentTexCord = textureCords[Number.parseInt(vertex[1]) - 1];
                textureCordArray[currentVertexPointer * 2] = currentTexCord[0];
                textureCordArray[currentVertexPointer * 2 + 1] = 1 - currentTexCord[1];
                let currentNormal = normals[Number.parseInt(vertex[2]) - 1];
                normalArray[currentVertexPointer * 3] = currentNormal[0];
                normalArray[currentVertexPointer * 3 + 1] = currentNormal[1];
                normalArray[currentVertexPointer * 3 + 2] = currentNormal[2];
                assembledVertices.push(new Vertex(vertices[currentVertexPointer], normals[Number.parseInt(vertex[2]) - 1], textureCords[Number.parseInt(vertex[1]) - 1]));
            }
            objFileContents.split(/\r\n|\r|\n/).forEach((currentLine) => {
                if (currentLine.startsWith("v ")) {
                    var lineSplit = currentLine.split(" ");
                    //@ts-ignore
                    vertices.push(vec3.fromValues(Number.parseFloat(lineSplit[1]), Number.parseFloat(lineSplit[2]), Number.parseFloat(lineSplit[3])));
                }
                else if (currentLine.startsWith("vn ")) {
                    if (vertexArray == undefined) {
                        vertexArray = new Float32Array(vertices.length * 3);
                        normalArray = new Float32Array(vertices.length * 3);
                        textureCordArray = new Float32Array(vertices.length * 2);
                    }
                    var lineSplit = currentLine.split(" ");
                    //@ts-ignore
                    normals.push(vec3.fromValues(Number.parseFloat(lineSplit[1]), Number.parseFloat(lineSplit[2]), Number.parseFloat(lineSplit[3])));
                }
                else if (currentLine.startsWith("vt ")) {
                    var lineSplit = currentLine.split(" ");
                    //@ts-ignore
                    textureCords.push(vec2.fromValues(Number.parseFloat(lineSplit[1]), Number.parseFloat(lineSplit[2])));
                }
                else if (currentLine.startsWith("f ")) {
                    var lineSplit = currentLine.split(" ");
                    processVertex(lineSplit[1].split("/"));
                    processVertex(lineSplit[2].split("/"));
                    processVertex(lineSplit[3].split("/"));
                }
                else {
                    console.warn(`Unknown keyword ${currentLine}`);
                }
            });
            vertices.forEach((currentVertex, i) => {
                vertexArray[i * 3] = currentVertex[0];
                vertexArray[i * 3 + 1] = currentVertex[1];
                vertexArray[i * 3 + 2] = currentVertex[2];
            });
            resolve(await VAO.loadVAOFromArray(gl, new VBOData(gl, vertexArray, program, "in_pos", 3, WebGL2RenderingContext.FLOAT), new VBOData(gl, normalArray, program, "in_normal", 3, WebGL2RenderingContext.FLOAT), new VBOData(gl, textureCordArray, program, "in_texCord", 2, WebGL2RenderingContext.FLOAT), new VBOData(gl, new Uint16Array(indices), program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true)));
        });
    }
    static async loadVAOFromArray(gl, ...vboData) {
        return new Promise(async (resolve) => {
            var vao = new VAO();
            vao.vao = gl.createVertexArray();
            vao.containsIndexBuffer = false;
            vao.bindVAO(gl);
            vao.vbos = await Promise.all((() => {
                var vboPromises = [];
                vboData.forEach((currentVBOData) => {
                    vboPromises.push(VBO.loadVBOFromArray(gl, currentVBOData));
                });
                return vboPromises;
            })());
            vao.unbindVAO(gl);
            vao.vbos.forEach((currentVBO) => {
                if (currentVBO.vboData.isIndexBuffer) {
                    vao.containsIndexBuffer = true;
                    vao.length = currentVBO.vboData.dataLength;
                }
            });
            if (!vao.containsIndexBuffer) {
                vao.length = vao.vbos[0].vboData.dataLength / vao.vbos[0].vboData.elementSize;
            }
            VAO.vaos.push(vao);
            resolve(VAO.vaos.length - 1);
        });
    }
}
class Texture {
    texture;
    static activeTextures = 0;
    static textures = [];
    activateTexture(gl) {
        gl.activeTexture(WebGL2RenderingContext.TEXTURE0 + Texture.activeTextures);
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, this.texture);
        Texture.activeTextures++;
    }
    disableTexture(gl) {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, null);
        Texture.activeTextures--;
    }
    bindTexture(gl) {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, this.texture);
    }
    unbindTexture(gl) {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, null);
    }
    static getTexture(textureID) {
        return Texture.textures[textureID];
    }
    static async loadTexture(gl, textureName) {
        return new Promise(async (resolve) => {
            var texture = new Texture();
            texture.texture = gl.createTexture();
            texture.bindTexture(gl);
            var image = await loadImage(textureName);
            gl.texImage2D(WebGL2RenderingContext.TEXTURE_2D, 0, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.UNSIGNED_BYTE, image);
            gl.generateMipmap(WebGL2RenderingContext.TEXTURE_2D);
            texture.unbindTexture(gl);
            Texture.textures.push(texture);
            resolve(Texture.textures.length - 1);
        });
    }
}
class Model {
    vaoID;
    textureID;
    constructor(vaoID, textureID) {
        this.vaoID = vaoID;
        this.textureID = textureID;
    }
}
class Entity {
    model;
    pos;
    rot;
    disableCulling;
    static G = 9.81;
    constructor(model, pos, rot, disableCulling = false) {
        this.model = model;
        this.pos = pos;
        this.rot = rot;
        //TODO: This is terrible
        this.disableCulling = disableCulling;
    }
    update(deltaTime) {
        if (this.pos[1] >= 0) {
            this.pos[1] -= Entity.G * deltaTime;
        }
    }
    createTransformationMatrix() {
        //@ts-ignore
        var transformationMatrix = mat4.create();
        //@ts-ignore
        mat4.translate(transformationMatrix, transformationMatrix, vec3.negate(vec3.create(), this.pos));
        rotateXYZ(transformationMatrix, this.rot);
        return transformationMatrix;
    }
}
class Light {
    dir;
    constructor(dir) {
        //@ts-ignore
        this.dir = vec3.create();
        //@ts-ignore
        vec3.normalize(this.dir, dir);
    }
}
class Camera {
    rot;
    pos;
    viewMatrix;
    static SPEED = 5;
    constructor(pos, rot) {
        this.rot = rot;
        this.pos = pos;
    }
    updateViewMatrix() {
        //@ts-ignore
        this.viewMatrix = mat4.identity(mat4.create());
        //@ts-ignore
        mat4.translate(this.viewMatrix, this.viewMatrix, vec3.negate(vec3.create(), this.pos));
        rotateXYZ(this.viewMatrix, this.rot);
        //@ts-ignore
        this.viewMatrix = mat4.invert(this.viewMatrix, this.viewMatrix);
    }
}
class Renderer {
    program;
    drawMode;
    projectionMatrix;
    projectionViewMatrixLocation;
    transformationMatrixLocation;
    reverseLightDirectionLocation;
    textureLocation;
    entityMap;
    static FOV = 60;
    static NEAR_PLANE = 0.1;
    static FAR_PLANE = 100;
    static async init(gl, programName) {
        return new Promise(async (resolve, reject) => {
            var renderer = new Renderer();
            renderer.program = await Program.loadProgram(gl, programName);
            renderer.drawMode = WebGL2RenderingContext.LINES;
            //@ts-ignore
            renderer.projectionMatrix = mat4.create();
            renderer.updateProjectionMatrix(gl);
            renderer.projectionViewMatrixLocation = renderer.program.getUniformLocation(gl, "u_projectionViewMatrix");
            renderer.transformationMatrixLocation = renderer.program.getUniformLocation(gl, "u_transformationMatrix");
            renderer.reverseLightDirectionLocation = renderer.program.getUniformLocation(gl, "u_reverseLightDirection");
            renderer.textureLocation = renderer.program.getUniformLocation(gl, "u_texture");
            resolve(renderer);
        });
    }
    static prepareViewport(gl) {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
    static clear(gl) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(WebGL2RenderingContext.COLOR_BUFFER_BIT);
    }
    delete(gl) {
        this.program.delete(gl);
    }
    updateProjectionMatrix(gl) {
        //@ts-ignore
        mat4.perspective(this.projectionMatrix, toRadians(Renderer.FOV), gl.canvas.width / gl.canvas.height, Renderer.NEAR_PLANE, Renderer.FAR_PLANE);
    }
    prepareEntities(entities) {
        this.entityMap = new Map();
        entities.forEach((currentEntity) => {
            if (!this.entityMap.has(currentEntity.model.vaoID)) {
                this.entityMap.set(currentEntity.model.vaoID, []);
            }
            this.entityMap.get(currentEntity.model.vaoID).push(currentEntity);
        });
    }
    render(gl, camera, light, entities) {
        this.prepareEntities(entities);
        Renderer.prepareViewport(gl);
        Renderer.clear(gl);
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        gl.enable(WebGL2RenderingContext.CULL_FACE);
        gl.cullFace(WebGL2RenderingContext.BACK);
        this.program.start(gl);
        //@ts-ignore
        var projectionViewMatrix = mat4.create();
        camera.updateViewMatrix();
        if (camera.viewMatrix === null) {
            console.log(camera.viewMatrix);
        }
        //@ts-ignore
        mat4.mul(projectionViewMatrix, this.projectionMatrix, camera.viewMatrix);
        this.entityMap.forEach((currentEntities, currentVAOID) => {
            VAO.vaos[currentVAOID].enableVAO(gl);
            currentEntities.forEach((currentEntity) => {
                //@ts-ignore
                if (vec3.distance(camera.pos, currentEntity.pos) > Renderer.FAR_PLANE) {
                    return;
                }
                Texture.getTexture(currentEntity.model.textureID).activateTexture(gl);
                this.program.loadDataToUniform(gl, this.projectionViewMatrixLocation, projectionViewMatrix);
                this.program.loadDataToUniform(gl, this.transformationMatrixLocation, currentEntity.createTransformationMatrix());
                this.program.loadDataToUniform(gl, this.reverseLightDirectionLocation, light.dir);
                if (VAO.vaos[currentVAOID].containsIndexBuffer) {
                    gl.drawElements(WebGL2RenderingContext.TRIANGLES, VAO.vaos[currentVAOID].length, gl.UNSIGNED_SHORT, 0);
                }
                else {
                    gl.drawArrays(WebGL2RenderingContext.TRIANGLES, 0, VAO.vaos[currentVAOID].length);
                }
                Texture.getTexture(currentEntity.model.textureID).disableTexture(gl);
            });
            VAO.vaos[currentVAOID].disableVAO(gl);
        });
        this.program.stop(gl);
    }
}
async function loadImage(imageName) {
    return new Promise((resolve) => {
        var image = new Image();
        image.src = `res/assets/${imageName}`;
        image.onload = () => {
            resolve(image);
        };
    });
}
function rotateXYZ(matrix, rot) {
    //@ts-ignore
    mat4.rotateX(matrix, matrix, toRadians(rot[0]));
    //@ts-ignore
    mat4.rotateY(matrix, matrix, toRadians(rot[1]));
    //@ts-ignore
    mat4.rotateZ(matrix, matrix, toRadians(rot[2]));
}
function toRadians(x) {
    return x * (Math.PI / 180);
}
function millisToSeconds(s) {
    return s * 0.001;
}
async function loadFile(url) {
    return new Promise(async (resolve, reject) => {
        fetch(url).then(async (response) => {
            if (response.ok) {
                resolve(await response.text());
            }
            else {
                reject(new Error(`HTTP Response code for file ${url}: ${response.status}-${response.statusText}!`));
            }
        });
    });
}
async function createContext() {
    return new Promise(async (resolve, reject) => {
        var canvas = document.createElement("canvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.id = "webgl_canvas";
        document.body.appendChild(canvas);
        let gl = canvas.getContext("webgl2");
        if (gl) {
            resolve(gl);
        }
        else {
            reject(new Error("Couldn't acquire WebGL2Context!"));
        }
    });
}
async function init() {
    var gl = await createContext();
    var renderer = await Renderer.init(gl, "shader");
    //@ts-ignore
    var camera = new Camera(vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 0));
    //@ts-ignore
    var sun = new Light(vec3.fromValues(5, 7, 10));
    var objVAO = await VAO.loadVAOFromOBJFile(gl, renderer.program, "test.obj");
    var objTex = await Texture.loadTexture(gl, "Suzanne.png");
    console.log(objTex);
    var entities = [];
    for (let i = 0; i < 200; i++) {
        entities.push(new Entity(new Model(objVAO, objTex), [4 * i, 10, 6], [0, 0, 0]));
    }
    var then = millisToSeconds(Date.now());
    var delta = 1;
    var isPointerLocked = false;
    document.getElementById("webgl_canvas").onresize = () => {
        renderer.updateProjectionMatrix(gl);
    };
    window.onkeydown = async (ev) => {
        if (ev.code === "KeyC") {
            camera.pos[1] += Camera.SPEED * delta;
        }
        else if (ev.code === "Space") {
            camera.pos[1] -= Camera.SPEED * delta;
        }
        if (ev.code === "KeyW") {
            let distance = Camera.SPEED * delta;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1]));
        }
        else if (ev.code === "KeyS") {
            let distance = Camera.SPEED * delta;
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1]));
        }
        if (ev.code === "KeyA") {
            let distance = Camera.SPEED * delta;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1] + 90));
        }
        else if (ev.code === "KeyD") {
            let distance = Camera.SPEED * delta;
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1] + 90));
        }
        if (ev.code === "KeyP") {
            renderer.updateProjectionMatrix(gl);
        }
        if (ev.code === "ShiftRight") {
            await document.getElementById("webgl_canvas").requestFullscreen();
            document.getElementById("webgl_canvas").requestPointerLock();
            renderer.updateProjectionMatrix(gl);
        }
    };
    document.onpointerlockchange = () => {
        isPointerLocked = !isPointerLocked;
    };
    window.onmousemove = (ev) => {
        if (isPointerLocked) {
            //camera.rot[0] += ev.movementY / gl.canvas.height * 180;
            camera.rot[1] -= ev.movementX / gl.canvas.width * 180;
        }
    };
    window.requestAnimationFrame(mainLoop);
    function mainLoop() {
        delta = millisToSeconds(Date.now()) - then;
        then = millisToSeconds(Date.now());
        gl.canvas.width = window.innerWidth;
        gl.canvas.height = window.innerHeight;
        console.log(1 / delta);
        entities.forEach((currentEntity) => {
            currentEntity.update(delta);
        });
        renderer.render(gl, camera, sun, entities);
        window.requestAnimationFrame(mainLoop);
    }
}
