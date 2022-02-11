"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Program {
    shaders;
    program;
    constructor(shaders = undefined, program = undefined) {
        this.shaders = shaders;
        this.program = program;
    }
    start(gl) {
        gl.useProgram(this.program);
    }
    stop(gl) {
        gl.useProgram(null);
    }
    loadDataToUniform(gl, location, data) {
        if (typeof data === "number") {
            if (data % 1 === 0) {
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
        else if (data instanceof vec2) {
            gl.uniform2fv(location, data);
            //@ts-ignore
        }
        else if (data instanceof vec3) {
            gl.uniform3fv(location, data);
            //@ts-ignore
        }
        else if (data instanceof vec4) {
            gl.uniform4fv(location, data);
            //@ts-ignore
        }
        else if (data instanceof mat2) {
            gl.uniformMatrix2fv(location, false, data);
            //@ts-ignore
        }
        else if (data instanceof mat3) {
            gl.uniformMatrix3fv(location, false, data);
            //@ts-ignore
        }
        else if (data instanceof mat4) {
            gl.uniformMatrix4fv(location, false, data);
        }
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
            var program = new Program(undefined, gl.createProgram());
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
    constructor(vboData = undefined, vbo = undefined) {
        this.vboData = vboData;
        this.vbo = vbo;
    }
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
            var vbo = new VBO(vboData, gl.createBuffer());
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
    constructor(vbos = undefined, vao = undefined) {
        this.vbos = vbos;
        this.vao = vao;
        this.containsIndexBuffer = false;
    }
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
            var vao = new VAO(undefined, gl.createVertexArray());
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
            resolve(vao);
        });
    }
}
class Renderer {
    vaos;
    projectionMatrix;
    constructor() {
        this.vaos = [];
    }
    static prepareViewport(gl) {
    }
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
async function main() {
    var gl = await createContext();
    var program = await Program.loadProgram(gl, "shader");
    var vao = await VAO.loadVAOFromArray(gl, new VBOData(gl, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), program, "in_pos", 2, WebGL2RenderingContext.FLOAT, false), new VBOData(gl, new Float32Array([1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1]), program, "in_col", 3, WebGL2RenderingContext.FLOAT, false), new VBOData(gl, new Uint16Array([0, 1, 2, 2, 3, 0]), program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true));
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(WebGL2RenderingContext.COLOR_BUFFER_BIT);
    program.start(gl);
    program.loadDataToUniform(gl, gl.getUniformLocation(program.program, "u_alpha"), 0.9);
    vao.enableVAO(gl);
    gl.drawElements(WebGL2RenderingContext.TRIANGLES, vao.length, WebGL2RenderingContext.UNSIGNED_SHORT, 0);
    vao.disableVAO(gl);
    vao.delete(gl);
    program.stop(gl);
    program.delete(gl);
}
