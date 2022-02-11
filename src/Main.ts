import type { vec2, vec3, vec4, mat2, mat3, mat4, glMatrix } from "gl-matrix";
class Program {
    shaders: WebGLShader[];
    program: WebGLProgram;
    constructor(shaders: WebGLShader[] = undefined, program: WebGLProgram = undefined) {
        this.shaders = shaders;
        this.program = program;
    }
    public start(gl: WebGL2RenderingContext): void {
        gl.useProgram(this.program);
    }
    public stop(gl: WebGL2RenderingContext): void {
        gl.useProgram(null);
    }
    public loadDataToUniform(gl: WebGL2RenderingContext, location: WebGLUniformLocation, data: number | boolean | vec2 | vec3 | vec4 | mat2 | mat3 | mat4): void {
        if (typeof data === "number") {
            if (data % 1 === 0) {
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
        //@ts-ignore
        } else if (data instanceof vec2){
            gl.uniform2fv(location, data);
        //@ts-ignore
        } else if (data instanceof vec3){
            gl.uniform3fv(location, data);
        //@ts-ignore
        } else if (data instanceof vec4){
            gl.uniform4fv(location, data);
        //@ts-ignore
        } else if (data instanceof mat2){
            gl.uniformMatrix2fv(location, false, data);
        //@ts-ignore
        } else if (data instanceof mat3){
            gl.uniformMatrix3fv(location, false, data);
        //@ts-ignore
        } else if (data instanceof mat4){
            gl.uniformMatrix4fv(location, false, data);
        }
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
            var program: Program = new Program(undefined, gl.createProgram());
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
    constructor(vboData: VBOData = undefined, vbo: WebGLBuffer = undefined) {
        this.vboData = vboData;
        this.vbo = vbo;
    }
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
            var vbo: VBO = new VBO(vboData, gl.createBuffer());
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
    constructor(vbos: VBO[] = undefined, vao: WebGLVertexArrayObject = undefined) {
        this.vbos = vbos;
        this.vao = vao;
        this.containsIndexBuffer = false;
    }
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
    public static async loadVAOFromArray(gl: WebGL2RenderingContext, ...vboData: VBOData[]): Promise<VAO> {
        return new Promise<VAO>(async (resolve, reject) => {
            var vao: VAO = new VAO(undefined, gl.createVertexArray());
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
            if(!vao.containsIndexBuffer){
                vao.length = vao.vbos[0].vboData.dataLength / vao.vbos[0].vboData.elementSize;
            }
            resolve(vao);
        });
    }
}
class Renderer {
    program:Program;
    drawMode:number;
    projectionMatrix: mat4;
    constructor(gl:WebGL2RenderingContext, programName:string) {
        Program.loadProgram(gl, programName).then((program:Program) => {
            this.program = program;
        });
        this.drawMode = WebGL2RenderingContext.TRIANGLES;
    }
    public static prepareViewport(gl: WebGL2RenderingContext): void {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
    public static clear(gl:WebGL2RenderingContext): void{
        gl.clearColor(0, 0, 0, 0);
        gl.clear(WebGL2RenderingContext.COLOR_BUFFER_BIT);
    }
    public delete(gl:WebGL2RenderingContext): void{
        this.program.delete(gl);
    }
    public render(gl:WebGL2RenderingContext, vaos:VAO[]): void{
        Renderer.prepareViewport(gl);
        Renderer.clear(gl);
        this.program.start(gl);
        vaos.forEach((currentVAO:VAO) => {
            currentVAO.enableVAO(gl);
            if(currentVAO.containsIndexBuffer){
                gl.drawElements(WebGL2RenderingContext.TRIANGLES, currentVAO.length, gl.UNSIGNED_SHORT, 0);
            }else{
                gl.drawArrays(WebGL2RenderingContext.TRIANGLES, 0, currentVAO.length);
            }
            currentVAO.disableVAO(gl);
        });
        this.program.stop(gl);
    }
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
    return new Promise<WebGL2RenderingContext>((resolve, reject) => {
        var canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);
        let gl: WebGL2RenderingContext = canvas.getContext("webgl2");
        if (gl) {
            resolve(gl);
        } else {
            reject(new Error("Couldn't acquire WebGL2Context!"));
        }
    });
}
async function main(): Promise<void> {
    var gl: WebGL2RenderingContext = await createContext();
    var program: Program = await Program.loadProgram(gl, "shader");
    var vao: VAO = await VAO.loadVAOFromArray(gl,
        new VBOData(gl, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), program, "in_pos", 2, WebGL2RenderingContext.FLOAT, false),
        new VBOData(gl, new Float32Array([1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1]), program, "in_col", 3, WebGL2RenderingContext.FLOAT, false),
        new VBOData(gl, new Uint16Array([0, 1, 2, 2, 3, 0]), program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true)
    );
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