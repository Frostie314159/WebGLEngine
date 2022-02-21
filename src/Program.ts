import { loadFile } from "./Util.js"
//@ts-ignore
import type { vec2, vec3, vec4, mat3, mat4 } from "gl-matrix";
//@ts-ignore
const { vec2, vec3, vec4, mat3, mat4 } = await import("./gl-matrix-min.js"); 
export class Program {
    shaders: WebGLShader[];
    program: WebGLProgram;
    public start(gl: WebGL2RenderingContext): void {
        gl.useProgram(this.program);
    }
    public stop(gl: WebGL2RenderingContext): void {
        gl.useProgram(null);
    }
    public loadDataToUniform(gl: WebGL2RenderingContext, location: WebGLUniformLocation, data: number | boolean | vec2 | vec3 | vec4 | mat3 | mat4, forceFloat = false): void {
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
            gl.uniform4fv(location, data)
        } else if (data.length === 9) {
            gl.uniformMatrix3fv(location, false, data);
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
    private static async loadShader(gl: WebGL2RenderingContext, name: string, type:number): Promise<WebGLShader> {
        return new Promise<WebGLShader>(async (resolve, reject) => {
            var shader: WebGLShader = gl.createShader(type);
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
            program.shaders = await Promise.all([Program.loadShader(gl, `${name}.vert`, WebGL2RenderingContext.VERTEX_SHADER), Program.loadShader(gl, `${name}.frag`, WebGL2RenderingContext.FRAGMENT_SHADER)]);
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