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
            //@ts-ignore
        }
        else if (data.length === 2) {
            gl.uniform2fv(location, data);
            //@ts-ignore
        }
        else if (data.length === 3) {
            gl.uniform3fv(location, data);
            //@ts-ignore
        }
        else if (data.length === 4) {
            gl.uniform4fv(location, data);
            //@ts-ignore
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
        return new Promise((resolve, reject) => {
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
    static async loadVAOFromArray(gl, ...vboData) {
        return new Promise(async (resolve, reject) => {
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
    isActive;
    static activeTextures = 0;
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
    static async loadTexture(gl, textureName) {
        return new Promise(async (resolve, reject) => {
            var texture = new Texture();
            texture.texture = gl.createTexture();
            texture.bindTexture(gl);
            var image = await loadImage(textureName);
            gl.texImage2D(WebGL2RenderingContext.TEXTURE_2D, 0, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.UNSIGNED_BYTE, image);
            gl.generateMipmap(WebGL2RenderingContext.TEXTURE_2D);
            texture.unbindTexture(gl);
        });
    }
}
class Model {
    vaoID;
    constructor(vaoID) {
        this.vaoID = vaoID;
    }
}
class Entity {
    model;
    pos;
    rot;
    static G = 9.81;
    constructor(model, pos, rot) {
        this.model = model;
        this.pos = pos;
        this.rot = rot;
    }
    update(deltaTime) {
        this.pos[1] -= Entity.G * deltaTime;
    }
    createTransformationMatrix() {
        //@ts-ignore
        var transformationMatrix = mat4.create();
        //@ts-ignore
        mat4.translate(transformationMatrix, transformationMatrix, this.pos);
        rotateXYZ(transformationMatrix, this.rot[0], this.rot[1], this.rot[2]);
        return transformationMatrix;
    }
}
class Camera {
    rot;
    pos;
    constructor(pos, rot) {
        this.rot = rot;
        this.pos = pos;
    }
    //@ts-ignore
    getViewMatrix() {
        //@ts-ignore
        return mat4.translate(mat4.create(), rotateXYZ(this.rot[0], this.rot[1], this.rot[2]), this.pos);
    }
}
class Renderer {
    program;
    drawMode;
    projectionMatrix;
    projectionMatrixLocation;
    transformationMatrixLocation;
    entityMap;
    static FOV = 90;
    static NEAR = 0.1;
    static FAR = 100;
    static async init(gl, programName) {
        return new Promise(async (resolve, reject) => {
            var renderer = new Renderer();
            renderer.program = await Program.loadProgram(gl, programName);
            renderer.drawMode = WebGL2RenderingContext.TRIANGLES;
            //@ts-ignore
            renderer.projectionMatrix = mat4.create();
            //@ts-ignore
            mat4.perspective(renderer.projectionMatrix, toRadians(90), gl.canvas.width / gl.canvas.height, Renderer.NEAR, Renderer.FAR);
            renderer.projectionMatrixLocation = renderer.program.getUniformLocation(gl, "in_projectionMatrix");
            renderer.transformationMatrixLocation = renderer.program.getUniformLocation(gl, "in_modelViewMatrix");
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
    prepareEntities(entities) {
        this.entityMap = new Map();
        entities.forEach((currentEntity) => {
            if (!this.entityMap.has(currentEntity.model)) {
                this.entityMap.set(currentEntity.model, []);
            }
            this.entityMap.get(currentEntity.model).push(currentEntity);
        });
    }
    render(gl, entities) {
        this.prepareEntities(entities);
        Renderer.prepareViewport(gl);
        Renderer.clear(gl);
        this.program.start(gl);
        this.entityMap.forEach((currentEntities, currentModel) => {
            VAO.vaos[currentModel.vaoID].enableVAO(gl);
            currentEntities.forEach((currentEntity) => {
                this.program.loadDataToUniform(gl, this.projectionMatrixLocation, this.projectionMatrix);
                this.program.loadDataToUniform(gl, this.transformationMatrixLocation, currentEntity.createTransformationMatrix());
                if (VAO.vaos[currentModel.vaoID].containsIndexBuffer) {
                    gl.drawElements(WebGL2RenderingContext.TRIANGLES, VAO.vaos[currentModel.vaoID].length, gl.UNSIGNED_SHORT, 0);
                }
                else {
                    gl.drawArrays(WebGL2RenderingContext.TRIANGLES, 0, VAO.vaos[currentModel.vaoID].length);
                }
            });
            VAO.vaos[currentModel.vaoID].disableVAO(gl);
        });
        this.program.stop(gl);
    }
}
async function loadImage(imageName) {
    return new Promise((resolve, reject) => {
        var image = new Image();
        image.src = `res/shaders/${imageName}.png`;
        image.onload = () => {
            resolve(image);
        };
    });
}
function rotateXYZ(matrix, x, y, z) {
    //@ts-ignore
    mat4.rotateX(matrix, matrix, toRadians(x));
    //@ts-ignore
    mat4.rotateY(matrix, matrix, toRadians(y));
    //@ts-ignore
    mat4.rotateZ(matrix, matrix, toRadians(z));
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
    return new Promise((resolve, reject) => {
        var canvas = document.createElement("canvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
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
    var vao = await VAO.loadVAOFromArray(gl, new VBOData(gl, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), renderer.program, "in_pos", 2, WebGL2RenderingContext.FLOAT, false), new VBOData(gl, new Float32Array([1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0]), renderer.program, "in_col", 3, WebGL2RenderingContext.FLOAT, false), new VBOData(gl, new Uint16Array([0, 1, 2, 2, 3, 0]), renderer.program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true));
    //@ts-ignore 
    var testEntity = new Entity(new Model(vao), [-0.0, 0.0, -6.0], vec3.fromValues(45, 45, 45));
    //@ts-ignore
    var testEntity2 = new Entity(new Model(vao), [-2.0, 0.0, -6.0], vec3.fromValues(45, 45, 45));
    var then = millisToSeconds(Date.now());
    var delta;
    console.log(testEntity.createTransformationMatrix());
    window.requestAnimationFrame(mainLoop);
    function mainLoop() {
        delta = millisToSeconds(Date.now()) - then;
        then = millisToSeconds(Date.now());
        gl.canvas.width = window.innerWidth;
        gl.canvas.height = window.innerHeight;
        renderer.render(gl, [testEntity, testEntity2]);
        console.log(renderer.entityMap);
        window.requestAnimationFrame(mainLoop);
    }
}
