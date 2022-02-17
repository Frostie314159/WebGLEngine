//@ts-ignore
import type { vec2, vec3, vec4, mat2, mat3, mat4, glMatrix, quat } from "gl-matrix";
//@ts-ignore
const { vec2, vec3, vec4, mat2, mat3, mat4 } = glMatrix;
class Program {
    shaders: WebGLShader[];
    program: WebGLProgram;
    public start(gl: WebGL2RenderingContext): void {
        gl.useProgram(this.program);
    }
    public stop(gl: WebGL2RenderingContext): void {
        gl.useProgram(null);
    }
    public loadDataToUniform(gl: WebGL2RenderingContext, location: WebGLUniformLocation, data: number | boolean | vec2 | vec3 | vec4 | mat4, forceFloat = false): void {
        if (typeof data === "number") {
            if (data % 1 === 0 && !forceFloat) {
                if (data < 0) {
                    gl.uniform1ui(location, data);
                } else {
                    gl.uniform1i(location, data);
                }
            } else {
                gl.uniform1f(location, data);
            }
        } else if (typeof data === "boolean") {
            gl.uniform1i(location, data ? 1 : 0);
        } else if (data.length === 2) {
            gl.uniform2fv(location, data);
        } else if (data.length === 3) {
            gl.uniform3fv(location, data);
        } else if (data.length === 4) {
            gl.uniform4fv(location, data);
        } else if (data.length === 16) {
            gl.uniformMatrix4fv(location, false, data);
        }
    }
    public getUniformLocation(gl: WebGL2RenderingContext, name: string): WebGLUniformLocation {
        return gl.getUniformLocation(this.program, name);
    }
    public delete(gl: WebGL2RenderingContext) {
        gl.deleteProgram(this.program);
    }
    private static detectShaderType(name: string): number {
        return name.includes(".vert") ? WebGL2RenderingContext.VERTEX_SHADER : WebGL2RenderingContext.FRAGMENT_SHADER;
    }
    private static async loadShader(gl: WebGL2RenderingContext, name: string): Promise<WebGLShader> {
        return new Promise<WebGLShader>(async (resolve, reject) => {
            var shader: WebGLShader = gl.createShader(this.detectShaderType(name));
            gl.shaderSource(shader, `#version 300 es
            ${await loadFile(`res/shaders/${name}`)}`);
            gl.compileShader(shader);
            if (gl.getShaderParameter(shader, WebGL2RenderingContext.COMPILE_STATUS)) {
                resolve(shader);
            } else {
                let shaderInfoLog: string = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                reject(new Error(shaderInfoLog));
            }
        })
    }
    public static async loadProgram(gl: WebGL2RenderingContext, name: string): Promise<Program> {
        return new Promise<Program>(async (resolve, reject) => {
            var program: Program = new Program();
            program.program = gl.createProgram();
            program.shaders = await Promise.all([Program.loadShader(gl, `${name}.vert`), Program.loadShader(gl, `${name}.frag`)]);
            program.shaders.forEach((currentShader: WebGLShader) => {
                gl.attachShader(program.program, currentShader);
            });
            gl.linkProgram(program.program);
            if (gl.getProgramParameter(program.program, WebGL2RenderingContext.LINK_STATUS)) {
                resolve(program);
            } else {
                let programInfoLog: string = gl.getProgramInfoLog(program.program);
                program.delete(gl);
                reject(new Error(programInfoLog));
            }
        })
    }
}
class VBOData {
    data: Float32Array | Uint16Array;
    dataLength: number;
    attribLocation: number;
    elementSize: number;
    elementType: number;
    isIndexBuffer: boolean;
    constructor(gl: WebGL2RenderingContext, data: Float32Array | Uint16Array, program: Program, attribLocationName: string, elementSize: number, elementType: number, isIndexBuffer: boolean = false) {
        this.data = data;
        this.dataLength = data.length;
        this.attribLocation = gl.getAttribLocation(program.program, attribLocationName);
        this.elementSize = elementSize;
        this.elementType = elementType;
        this.isIndexBuffer = isIndexBuffer;
    }
}
class VBO {
    vboData: VBOData;
    vbo: WebGLBuffer;
    public bindVBO(gl: WebGL2RenderingContext): void {
        gl.bindBuffer((this.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), this.vbo);
    }
    public unbindVBO(gl: WebGL2RenderingContext): void {
        gl.bindBuffer((this.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), null);
    }
    public enableVBO(gl: WebGL2RenderingContext): void {
        if (this.vboData.isIndexBuffer) {
            this.bindVBO(gl);
        } else {
            gl.enableVertexAttribArray(this.vboData.attribLocation);
        }
    }
    public disableVBO(gl: WebGL2RenderingContext): void {
        if (this.vboData.isIndexBuffer) {
            this.unbindVBO(gl);
        } else {
            gl.disableVertexAttribArray(this.vboData.attribLocation);
        }
    }
    public delete(gl: WebGL2RenderingContext): void {
        gl.deleteBuffer(this.vbo);
    }
    public static async loadVBOFromArray(gl: WebGL2RenderingContext, vboData: VBOData): Promise<VBO> {
        return new Promise<VBO>((resolve, reject) => {
            var vbo: VBO = new VBO();
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
    vbos: VBO[];
    vao: WebGLVertexArrayObject;
    length: number;
    containsIndexBuffer: boolean;
    static vaos: VAO[] = [];
    public bindVAO(gl: WebGL2RenderingContext): void {
        gl.bindVertexArray(this.vao);
    }
    public unbindVAO(gl: WebGL2RenderingContext): void {
        gl.bindVertexArray(null);
    }
    public enableVAO(gl: WebGL2RenderingContext): void {
        this.bindVAO(gl);
        this.vbos.forEach((currentVBO: VBO) => {
            currentVBO.enableVBO(gl);
        });
    }
    public disableVAO(gl: WebGL2RenderingContext): void {
        this.vbos.reverse().forEach((currentVBO: VBO) => {
            currentVBO.disableVBO(gl);
        });
        this.unbindVAO(gl);
    }
    public delete(gl: WebGL2RenderingContext): void {
        this.vbos.reverse().forEach((currentVBO: VBO) => {
            currentVBO.delete(gl);
        });
        gl.deleteVertexArray(this.vao);
    }
    public static getVAO(vaoID: number): VAO {
        return VAO.vaos[vaoID];
    }
    public static async loadVAOFromOBJFile(gl: WebGL2RenderingContext, program: Program, objName: string): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            class Vertex {
                position: vec3;
                normal: vec3;
                textureCord: vec2;
                constructor(position: vec3, normal: vec3, textureCord: vec2) {
                    this.position = position;
                    this.normal = normal;
                    this.textureCord = textureCord;
                }
            }
            var vertices: vec3[] = [];
            var normals: vec3[] = [];
            var textureCords: vec2[] = [];
            var indices: number[] = [];
            var assembledVertices: Vertex[] = [];
            var vertexArray: Float32Array;
            var normalArray: Float32Array;
            var textureCordArray: Float32Array;
            var objFileContents: string = await loadFile(`res/assets/${objName}`);
            function processVertex(vertex: string[]): void {
                let currentVertexPointer: number = Number.parseInt(vertex[0]) - 1;
                indices.push(currentVertexPointer);
                let currentTexCord: vec2 = textureCords[Number.parseInt(vertex[1]) - 1];
                textureCordArray[currentVertexPointer * 2] = currentTexCord[0];
                textureCordArray[currentVertexPointer * 2 + 1] = 1 - currentTexCord[1];
                let currentNormal: vec3 = normals[Number.parseInt(vertex[2]) - 1];
                normalArray[currentVertexPointer * 3] = currentNormal[0];
                normalArray[currentVertexPointer * 3 + 1] = currentNormal[1];
                normalArray[currentVertexPointer * 3 + 2] = currentNormal[2];
                assembledVertices.push(new Vertex(vertices[currentVertexPointer], normals[Number.parseInt(vertex[2]) - 1], textureCords[Number.parseInt(vertex[1]) - 1]));
            }
            objFileContents.split(/\r\n|\r|\n/).forEach((currentLine: string) => {
                if (currentLine.startsWith("v ")) {
                    var lineSplit: string[] = currentLine.split(" ");
                    //@ts-ignore
                    vertices.push(vec3.fromValues(Number.parseFloat(lineSplit[1]), Number.parseFloat(lineSplit[2]), Number.parseFloat(lineSplit[3])));
                } else if (currentLine.startsWith("vn ")) {
                    if (vertexArray == undefined) {
                        vertexArray = new Float32Array(vertices.length * 3);
                        normalArray = new Float32Array(vertices.length * 3);
                        textureCordArray = new Float32Array(vertices.length * 2);
                    }
                    var lineSplit: string[] = currentLine.split(" ");
                    //@ts-ignore
                    normals.push(vec3.fromValues(Number.parseFloat(lineSplit[1]), Number.parseFloat(lineSplit[2]), Number.parseFloat(lineSplit[3])));
                } else if (currentLine.startsWith("vt ")) {
                    var lineSplit: string[] = currentLine.split(" ");
                    //@ts-ignore
                    textureCords.push(vec2.fromValues(Number.parseFloat(lineSplit[1]), Number.parseFloat(lineSplit[2])));
                } else if (currentLine.startsWith("f ")) {
                    var lineSplit: string[] = currentLine.split(" ");
                    processVertex(lineSplit[1].split("/"));
                    processVertex(lineSplit[2].split("/"));
                    processVertex(lineSplit[3].split("/"));
                } else {
                    console.warn(`Unknown keyword ${currentLine}`);
                }
            });
            vertices.forEach((currentVertex: vec3, i: number) => {
                vertexArray[i * 3] = currentVertex[0];
                vertexArray[i * 3 + 1] = currentVertex[1];
                vertexArray[i * 3 + 2] = currentVertex[2];
            });
            resolve(await VAO.loadVAOFromArray(gl,
                new VBOData(gl, vertexArray, program, "in_pos", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, normalArray, program, "in_normal", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, new Uint16Array(indices), program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true)
            ));
        });
    }
    public static async loadVAOFromArray(gl: WebGL2RenderingContext, ...vboData: VBOData[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            var vao: VAO = new VAO();
            vao.vao = gl.createVertexArray();
            vao.containsIndexBuffer = false;
            vao.bindVAO(gl);
            vao.vbos = await Promise.all(((): Promise<VBO>[] => {
                var vboPromises: Promise<VBO>[] = [];
                vboData.forEach((currentVBOData: VBOData) => {
                    vboPromises.push(VBO.loadVBOFromArray(gl, currentVBOData));
                });
                return vboPromises;
            })());
            vao.unbindVAO(gl);
            vao.vbos.forEach((currentVBO: VBO) => {
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
    texture: WebGLTexture;
    static activeTextures: number = 0;
    public activateTexture(gl: WebGL2RenderingContext): void {
        gl.activeTexture(WebGL2RenderingContext.TEXTURE0 + Texture.activeTextures);
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, this.texture);
        Texture.activeTextures++;
    }
    public disableTexture(gl: WebGL2RenderingContext): void {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, null);
        Texture.activeTextures--;
    }
    public bindTexture(gl: WebGL2RenderingContext): void {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, this.texture);
    }
    public unbindTexture(gl: WebGL2RenderingContext): void {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, null);
    }
    public static async loadTexture(gl: WebGL2RenderingContext, textureName: string): Promise<Texture> {
        return new Promise<Texture>(async (resolve, reject) => {
            var texture: Texture = new Texture();
            texture.texture = gl.createTexture();
            texture.bindTexture(gl);
            var image: HTMLImageElement = await loadImage(textureName);
            gl.texImage2D(WebGL2RenderingContext.TEXTURE_2D, 0, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.UNSIGNED_BYTE, image);
            gl.generateMipmap(WebGL2RenderingContext.TEXTURE_2D);
            texture.unbindTexture(gl);
        });
    }
}
class Model {
    vaoID: number;
    constructor(vaoID: number) {
        this.vaoID = vaoID;
    }
}
class Entity {
    model: Model;
    pos: vec3;
    rot: vec3;
    disableCulling:boolean;
    static G = 9.81;
    constructor(model: Model, pos: vec3, rot: vec3, disableCulling:boolean = false) {
        this.model = model;
        this.pos = pos;
        this.rot = rot;
        //TODO: This is terrible
        this.disableCulling = disableCulling;
    }
    public update(deltaTime: number): void {
        if(this.pos[1] >= 0){
            this.pos[1] -= Entity.G * deltaTime;
        }
    }
    public createTransformationMatrix(): mat4 {
        //@ts-ignore
        var transformationMatrix: mat4 = mat4.create();
        //@ts-ignore
        mat4.translate(transformationMatrix, transformationMatrix, vec3.negate(vec3.create(), this.pos));

        rotateXYZ(transformationMatrix, this.rot);

        return transformationMatrix;
    }
}
class Light {
    dir: vec3;
    constructor(dir: vec3) {
        //@ts-ignore
        this.dir = vec3.create();
        //@ts-ignore
        vec3.normalize(this.dir, dir);
    }
}
class Camera {
    rot: vec3;
    pos: vec3;
    viewMatrix: mat4;
    static SPEED: number = 5;
    constructor(pos: vec3, rot: vec3) {
        this.rot = rot;
        this.pos = pos;
    }
    public updateViewMatrix(): void {
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
    program: Program;
    drawMode: number;
    projectionMatrix: mat4;
    projectionViewMatrixLocation: WebGLUniformLocation;
    transformationMatrixLocation: WebGLUniformLocation;
    reverseLightDirectionLocation: WebGLUniformLocation;
    entityMap: Map<number, Entity[]>;
    static FOV: number = 60;
    static NEAR_PLANE: number = 0.1;
    static FAR_PLANE: number = 100;
    public static async init(gl: WebGL2RenderingContext, programName: string): Promise<Renderer> {
        return new Promise<Renderer>(async (resolve, reject) => {
            var renderer: Renderer = new Renderer();
            renderer.program = await Program.loadProgram(gl, programName);
            renderer.drawMode = WebGL2RenderingContext.LINES;
            //@ts-ignore
            renderer.projectionMatrix = mat4.create();
            renderer.updateProjectionMatrix(gl);
            renderer.projectionViewMatrixLocation = renderer.program.getUniformLocation(gl, "u_projectionViewMatrix");
            renderer.transformationMatrixLocation = renderer.program.getUniformLocation(gl, "u_transformationMatrix");
            renderer.reverseLightDirectionLocation = renderer.program.getUniformLocation(gl, "u_reverseLightDirection");
            resolve(renderer);
        });
    }
    public static prepareViewport(gl: WebGL2RenderingContext): void {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
    public static clear(gl: WebGL2RenderingContext): void {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(WebGL2RenderingContext.COLOR_BUFFER_BIT);
    }
    public delete(gl: WebGL2RenderingContext): void {
        this.program.delete(gl);
    }
    public updateProjectionMatrix(gl: WebGL2RenderingContext): void {
        //@ts-ignore
        mat4.perspective(this.projectionMatrix, toRadians(Renderer.FOV), gl.canvas.width / gl.canvas.height, Renderer.NEAR_PLANE, Renderer.FAR_PLANE);
    }
    public prepareEntities(entities: Entity[]): void {
        this.entityMap = new Map<number, Entity[]>();
        entities.forEach((currentEntity: Entity) => {
            if (!this.entityMap.has(currentEntity.model.vaoID)) {
                this.entityMap.set(currentEntity.model.vaoID, []);
            }
            this.entityMap.get(currentEntity.model.vaoID).push(currentEntity);
        });
    }
    public render(gl: WebGL2RenderingContext, camera: Camera, light: Light, entities: Entity[]): void {
        this.prepareEntities(entities);
        Renderer.prepareViewport(gl);
        Renderer.clear(gl);
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        gl.enable(WebGL2RenderingContext.CULL_FACE);
        gl.cullFace(WebGL2RenderingContext.BACK);
        this.program.start(gl);
        //@ts-ignore
        var projectionViewMatrix: mat4 = mat4.create();
        camera.updateViewMatrix();
        if(camera.viewMatrix === null){
            console.log(camera.viewMatrix);
        }
        //@ts-ignore
        mat4.mul(projectionViewMatrix, this.projectionMatrix, camera.viewMatrix);
        this.entityMap.forEach((currentEntities: Entity[], currentVAOID: number) => {
            VAO.vaos[currentVAOID].enableVAO(gl);
            currentEntities.forEach((currentEntity: Entity) => {
                //@ts-ignore
                if(vec3.distance(camera.pos, currentEntity.pos) > Renderer.FAR_PLANE){
                    return;
                }
                this.program.loadDataToUniform(gl, this.projectionViewMatrixLocation, projectionViewMatrix);
                this.program.loadDataToUniform(gl, this.transformationMatrixLocation, currentEntity.createTransformationMatrix());
                this.program.loadDataToUniform(gl, this.reverseLightDirectionLocation, light.dir);
                if (VAO.vaos[currentVAOID].containsIndexBuffer) {
                    gl.drawElements(WebGL2RenderingContext.TRIANGLES, VAO.vaos[currentVAOID].length, gl.UNSIGNED_SHORT, 0);
                } else {
                    gl.drawArrays(WebGL2RenderingContext.TRIANGLES, 0, VAO.vaos[currentVAOID].length);
                }
            });
            VAO.vaos[currentVAOID].disableVAO(gl);
        });
        this.program.stop(gl);
    }
}
async function loadImage(imageName: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve) => {
        var image: HTMLImageElement = new Image();
        image.src = `res/shaders/${imageName}.png`;
        image.onload = () => {
            resolve(image);
        };
    });
}
function rotateXYZ(matrix: mat4, rot: vec3): void {
    //@ts-ignore
    mat4.rotateX(matrix, matrix, toRadians(rot[0]));
    //@ts-ignore
    mat4.rotateY(matrix, matrix, toRadians(rot[1]));
    //@ts-ignore
    mat4.rotateZ(matrix, matrix, toRadians(rot[2]));
}
function toRadians(x: number): number {
    return x * (Math.PI / 180);
}
function millisToSeconds(s: number): number {
    return s * 0.001;
}
async function loadFile(url: string): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        fetch(url).then(async (response: Response) => {
            if (response.ok) {
                resolve(await response.text());
            } else {
                reject(new Error(`HTTP Response code for file ${url}: ${response.status}-${response.statusText}!`))
            }
        });
    })
}
async function createContext(): Promise<WebGL2RenderingContext> {
    return new Promise<WebGL2RenderingContext>(async (resolve, reject) => {
        var canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.id = "webgl_canvas";
        document.body.appendChild(canvas);
        let gl: WebGL2RenderingContext = canvas.getContext("webgl2");
        if (gl) {
            resolve(gl);
        } else {
            reject(new Error("Couldn't acquire WebGL2Context!"));
        }
    });
}
async function init(): Promise<void> {
    var gl: WebGL2RenderingContext = await createContext();

    var renderer: Renderer = await Renderer.init(gl, "shader");

    //@ts-ignore
    var camera: Camera = new Camera(vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 0));

    //@ts-ignore
    var sun: Light = new Light(vec3.fromValues(5, 7, 10));

    var objVBO: number = await VAO.loadVAOFromOBJFile(gl, renderer.program, "test.obj");

    var entities: Entity[] = [];
    for (let i: number = 0; i < 200; i++) {
        entities.push(new Entity(new Model(objVBO), [4 * i, 10, 6], [0, 0, 0]));
    }

    var then: number = millisToSeconds(Date.now());
    var delta: number = 1;
    var isPointerLocked: boolean = false;

    document.getElementById("webgl_canvas").onresize = () => {
        renderer.updateProjectionMatrix(gl);
    };
    window.onkeydown = async (ev: KeyboardEvent) => {
        if (ev.code === "KeyC") {
            camera.pos[1] += Camera.SPEED * delta;
        } else if (ev.code === "Space") {
            camera.pos[1] -= Camera.SPEED * delta;
        }
        if (ev.code === "KeyW") {
            let distance:number = Camera.SPEED * delta;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1]));
        } else if (ev.code === "KeyS") {
            let distance:number = Camera.SPEED * delta;
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1]));
        }
        if (ev.code === "KeyA") {
            let distance:number = Camera.SPEED * delta;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1] + 90));
        } else if (ev.code === "KeyD") {
            let distance:number = Camera.SPEED * delta;
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1] + 90));
        }
        if(ev.code === "KeyP"){
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
    window.onmousemove = (ev: MouseEvent) => {
        if (isPointerLocked) {
            //camera.rot[0] += ev.movementY / gl.canvas.height * 180;
            camera.rot[1] -= ev.movementX / gl.canvas.width * 180;
        }
    };
    window.requestAnimationFrame(mainLoop);
    function mainLoop(): void {
        delta = millisToSeconds(Date.now()) - then;
        then = millisToSeconds(Date.now());
        gl.canvas.width = window.innerWidth;
        gl.canvas.height = window.innerHeight;
        entities.forEach((currentEntity:Entity) => {
            currentEntity.update(delta);
        });
        renderer.render(gl, camera, sun, entities);
        window.requestAnimationFrame(mainLoop);
    }
}