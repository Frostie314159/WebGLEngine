import {vec2, vec3, vec4, mat2, mat3, mat4, glMatrix} from "gl-matrix";
glMatrix.setMatrixArrayType(Array);
class Program{
    shaders:WebGLShader[];
    program:WebGLProgram;
    constructor(shaders:WebGLShader[] = undefined, program:WebGLProgram = undefined){
        this.shaders = shaders;
        this.program = program;
    }
    public delete(gl:WebGL2RenderingContext){
        gl.deleteProgram(this.program);
    }
    private static detectShaderType(name:string): number{
        return name.includes(".vert") ? WebGL2RenderingContext.VERTEX_SHADER : WebGL2RenderingContext.FRAGMENT_SHADER;
    }
    private static async loadShader(gl:WebGL2RenderingContext, name:string): Promise<WebGLShader>{
        return new Promise<WebGLShader>(async (resolve, reject) => {
            var shader:WebGLShader = gl.createShader(this.detectShaderType(name));
            gl.shaderSource(shader, `#version 300 es
            ${await loadFile(`res/shaders/${name}`)}`);
            gl.compileShader(shader);
            if(gl.getShaderParameter(shader, WebGL2RenderingContext.COMPILE_STATUS)){
                resolve(shader);
            }else{
                let shaderInfoLog:string = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                reject(new Error(shaderInfoLog));
            }
        })
    }
    public static async loadProgram(gl:WebGL2RenderingContext, name:string): Promise<Program>{
        return new Promise<Program>(async (resolve, reject) => {
            var program:Program = new Program(undefined, gl.createProgram());
            program.shaders = await Promise.all([Program.loadShader(gl, `${name}.vert`), Program.loadShader(gl, `${name}.frag`)]);
            program.shaders.forEach((currentShader:WebGLShader) => {
                gl.attachShader(program.program, currentShader);
            });
            gl.linkProgram(program.program);
            if(gl.getProgramParameter(program.program, WebGL2RenderingContext.LINK_STATUS)){
                resolve(program);
            }else{
                let programInfoLog:string = gl.getProgramInfoLog(program.program);
                program.delete(gl);
                reject(new Error(programInfoLog));
            }
        })
    }
}
class VBOData{
    data:Float32Array;
    dataLength:number;
    attribLocation:number;
    elementSize:number;
    elementType:number;
    isIndexBuffer:boolean;
    constructor(gl:WebGL2RenderingContext, data:Float32Array, program:Program, attribLocationName:string, elementSize:number, elementType:number, isIndexBuffer:boolean = false){
        this.data = data;
        this.dataLength = data.length;
        this.attribLocation = gl.getAttribLocation(program, attribLocationName);
        this.elementSize = elementSize;
        this.elementType = elementType;
        this.isIndexBuffer = isIndexBuffer;
    }
}
class VBO{
    vboData:VBOData;
    vbo:WebGLBuffer;
    constructor(vboData:VBOData = undefined, vbo:WebGLBuffer = undefined){
        this.vboData = vboData;
        this.vbo = vbo;
    }
    public bind(gl:WebGL2RenderingContext): void{
        gl.bindBuffer((this.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), this.vbo);
    }
    public unbind(gl:WebGL2RenderingContext): void{
        gl.bindBuffer((this.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), null);
    }
    public enableVBO(gl:WebGL2RenderingContext): void{
        if(this.vboData.isIndexBuffer){
            this.bind(gl);
        }else{
            gl.enableVertexAttribArray(this.vboData.attribLocation);
        }
    }
    public disableVBO(gl:WebGL2RenderingContext): void{
        if(this.vboData.isIndexBuffer){
            this.unbind(gl);
        }else{
            gl.disableVertexAttribArray(this.vboData.attribLocation);
        }
    }
    public static async loadVBOFromArray(gl:WebGL2RenderingContext, vboData:VBOData): Promise<VBO>{
        return new Promise<VBO>((resolve, reject) => {
            var vbo:VBO = new VBO(vboData, gl.createBuffer());
            vbo.bind(gl);
            vbo.enableVBO(gl);
            gl.bufferData((vbo.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), vboData.data, WebGL2RenderingContext.STATIC_DRAW);

        });
    }
}
async function loadFile(url:string): Promise<string>{
    return new Promise<string>(async (resolve, reject) => {
        fetch(url).then(async (response:Response) => {
            if(response.ok){
                resolve(await response.text());
            }else{
                reject(new Error(`HTTP Response code for file ${url}: ${response.status}-${response.statusText}!`))
            }
        });
    })
}
async function createContext(): Promise<WebGL2RenderingContext>{
    return new Promise<WebGL2RenderingContext>((resolve, reject) => {
        var canvas:HTMLCanvasElement = document.createElement("canvas");
        canvas.width = screen.width;
        canvas.height = screen.height;
        document.body.appendChild(canvas);
        let gl:WebGL2RenderingContext = canvas.getContext("webgl2");
        if(gl){
            resolve(gl);
        }else{
            reject(new Error("Couldn't acquire WebGL2Context!"));
        }
    });
}
async function main():Promise<void> {
    var gl:WebGL2RenderingContext = await createContext();
    var program:Program = await Program.loadProgram(gl, "shader");
    program.delete(gl);
}