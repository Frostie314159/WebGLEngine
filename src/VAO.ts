import { VBO } from "./VBO.js";
import { VBOData } from "./VBOData.js";
import { loadFile } from "./Util.js";
import { Program } from "./Program.js";
//@ts-ignore
import type { vec2, vec3 } from "gl-matrix";
//@ts-ignore
const { vec2, vec3 } = await import("./node_modules/gl-matrix/esm/index.js");
export class VAO {
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
    public static deleteALL(gl:WebGL2RenderingContext): void{
        VAO.vaos.reverse().forEach((currentVAO:VAO) => {
            currentVAO.delete(gl);
        });
    }
    public static getVAO(vaoID: number): VAO {
        return VAO.vaos[vaoID];
    }
    public static async loadVAOFromOBJFile(gl: WebGL2RenderingContext, program: Program, objName: string): Promise<number> {
        return new Promise<number>(async (resolve) => {
            var vertices: vec3[] = [];
            var normals: vec3[] = [];
            var textureCords: vec2[] = [];
            var indices: number[] = [];
            var vertexArray: Float32Array;
            var normalArray: Float32Array;
            var textureCordArray: Float32Array;
            var objFileContents: string = await loadFile(`res/assets/${objName}.obj`);
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
                new VBOData(gl, textureCordArray, program, "in_texCord", 2, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, new Uint16Array(indices), program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true)
            ));
        });
    }
    public static async loadVAOFromArray(gl: WebGL2RenderingContext, ...vboData: VBOData[]): Promise<number> {
        return new Promise<number>(async (resolve) => {
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