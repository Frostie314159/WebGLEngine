//@ts-ignore
import type { vec2, vec3, vec4, mat2, mat3, mat4, glMatrix, quat } from "gl-matrix";
import init, { generate_terrain_mesh, get_range_from_array, convert_float_array_to_uint_array } from "../perlin-noise/WASM-PerlinNoise/pkg/perlin_noise.js";
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
    public getUniformLocation(gl: WebGL2RenderingContext, name: string): WebGLUniformLocation {
        return gl.getUniformLocation(this.program, name);
    }
    public delete(gl: WebGL2RenderingContext) {
        gl.deleteProgram(this.program);
    }
    private static detectShaderType(name: string): number {
        return name.endsWith(".vert") ? WebGL2RenderingContext.VERTEX_SHADER : WebGL2RenderingContext.FRAGMENT_SHADER;
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
    public static async loadVBOFromArray(gl: WebGL2RenderingContext, vboData: VBOData, dynamicDraw: boolean = false): Promise<VBO> {
        return new Promise<VBO>((resolve) => {
            var vbo: VBO = new VBO();
            vbo.vbo = gl.createBuffer();
            vbo.vboData = vboData;
            vbo.bindVBO(gl);
            gl.bufferData((vbo.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER),
                vboData.data,
                dynamicDraw ? WebGL2RenderingContext.DYNAMIC_DRAW : WebGL2RenderingContext.STATIC_DRAW);

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
    public static deleteALL(gl: WebGL2RenderingContext): void {
        VAO.vaos.reverse().forEach((currentVAO: VAO) => {
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

            var processedVertices: number[] = [];
            var processedNormals: number[] = [];
            var processedTextureCords: number[] = [];

            var objFileContents: string = await loadFile(`res/assets/${objName}.obj`);
            function processVertex(vertex: string[]): void {
                let currentVertex: number = Number.parseInt(vertex[0]) - 1;
                let currentTexCord: number = Number.parseInt(vertex[1]) - 1;
                let currentNormal: number = Number.parseInt(vertex[2]) - 1;
                processedVertices.push(vertices[currentVertex][0]);
                processedVertices.push(vertices[currentVertex][1]);
                processedVertices.push(vertices[currentVertex][2]);
                processedNormals.push(normals[currentNormal][0]);
                processedNormals.push(normals[currentNormal][1]);
                processedNormals.push(normals[currentNormal][2]);
                processedTextureCords.push(textureCords[currentTexCord][0]);
                processedTextureCords.push(textureCords[currentTexCord][1]);
                /*
                let currentVertexPointer: number = Number.parseInt(vertex[0]) - 1;
                indices.push(currentVertexPointer);
                let currentTexCord: vec2 = textureCords[Number.parseInt(vertex[1]) - 1];
                textureCordArray[currentVertexPointer * 2] = currentTexCord[0];
                textureCordArray[currentVertexPointer * 2 + 1] = 1 - currentTexCord[1];
                let currentNormal: vec3 = normals[Number.parseInt(vertex[2]) - 1];
                normalArray[currentVertexPointer * 3] = currentNormal[0];
                normalArray[currentVertexPointer * 3 + 1] = currentNormal[1];
                normalArray[currentVertexPointer * 3 + 2] = currentNormal[2];
                */
            }
            objFileContents.split(/\r\n|\r|\n/).forEach((currentLine: string) => {
                if (currentLine.startsWith("v ")) {
                    var lineSplit: string[] = currentLine.split(" ");
                    //@ts-ignore
                    vertices.push(vec3.fromValues(Number.parseFloat(lineSplit[1]), Number.parseFloat(lineSplit[2]), Number.parseFloat(lineSplit[3])));
                } else if (currentLine.startsWith("vn ")) {
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
            resolve(await VAO.loadVAOFromArray(gl, false,
                new VBOData(gl, new Float32Array(processedVertices), program, "in_pos", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, new Float32Array(processedNormals), program, "in_normal", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, new Float32Array(processedTextureCords), program, "in_texCord", 2, WebGL2RenderingContext.FLOAT)
            ));
        });
    }
    public static async loadVAOFromArray(gl: WebGL2RenderingContext, dynamicDraw: boolean = false, ...vboData: VBOData[]): Promise<number> {
        return new Promise<number>(async (resolve) => {
            var vao: VAO = new VAO();
            vao.vao = gl.createVertexArray();
            vao.containsIndexBuffer = false;
            vao.bindVAO(gl);
            vao.vbos = await Promise.all(((): Promise<VBO>[] => {
                var vboPromises: Promise<VBO>[] = [];
                vboData.forEach((currentVBOData: VBOData) => {
                    vboPromises.push(VBO.loadVBOFromArray(gl, currentVBOData, dynamicDraw));
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
    static textures: Texture[] = [];
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
    public delete(gl: WebGL2RenderingContext): void {
        gl.deleteTexture(this.texture);
    }
    public static deleteALL(gl: WebGL2RenderingContext): void {
        Texture.textures.reverse().forEach((currentTexture: Texture) => {
            currentTexture.delete(gl);
        });
    }
    public static getTexture(textureID: number): Texture {
        return Texture.textures[textureID];
    }
    public static async loadTexture(gl: WebGL2RenderingContext, textureName: string): Promise<number> {
        return new Promise<number>(async (resolve) => {
            var texture: Texture = new Texture();
            texture.texture = gl.createTexture();
            texture.bindTexture(gl);
            var image: HTMLImageElement = await loadImage(`res/assets/${textureName}`);
            gl.texImage2D(WebGL2RenderingContext.TEXTURE_2D, 0, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.UNSIGNED_BYTE, image);
            gl.generateMipmap(WebGL2RenderingContext.TEXTURE_2D);
            texture.unbindTexture(gl);
            Texture.textures.push(texture);
            resolve(Texture.textures.length - 1);
        });
    }
}
class Model {
    vaoID: number;
    textureID: number;
    static models: Model[] = [];
    public static getModel(modelID: number): Model {
        return Model.models[modelID];
    }
    public static async loadModel(gl: WebGL2RenderingContext, program: Program, name: string): Promise<number> {
        return new Promise<number>(async (resolve) => {
            var model: Model = new Model();
            model.vaoID = await VAO.loadVAOFromOBJFile(gl, program, name);
            model.textureID = await Texture.loadTexture(gl, `${name}.png`);
            Model.models.push(model);
            resolve(Model.models.length - 1);
        });
    }
    public static async loadModelWithSeperateResources(gl: WebGL2RenderingContext, program: Program, modelName: string, textureName: string): Promise<number> {
        return new Promise<number>(async (resolve) => {
            var model: Model = new Model();
            model.vaoID = await VAO.loadVAOFromOBJFile(gl, program, modelName);
            model.textureID = await Texture.loadTexture(gl, textureName);
            Model.models.push(model);
            resolve(Model.models.length - 1);
        });
    }
}
class Entity {
    modelID: number;
    pos: vec3;
    rot: vec3;
    disableFarPlaneCulling: boolean;
    disableBackFaceCulling: boolean;
    static G = 9.81;
    constructor(modelID: number, pos: vec3, rot: vec3, disableBackFaceCulling: boolean = false, disableFarPlaneCulling: boolean = false) {
        this.modelID = modelID;
        this.pos = pos;
        this.rot = rot;
        //TODO: This is terrible
        this.disableFarPlaneCulling = disableFarPlaneCulling;
        this.disableBackFaceCulling = disableBackFaceCulling;
    }
    public update(deltaTime: number): void {
        if (this.pos[1] <= 0) {
            this.pos[1] += Entity.G * deltaTime;
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
class PerlinNoiseGenerator {
    seed: number;
    stepSize: number;
    private static AMPLITUDE: number = 7;
    private static OCTAVES: number = 2;
    private static ROUGHNESS: number = 0.3;
    constructor(seed: number, stepSize: number) {
        this.seed = seed;
        this.stepSize = stepSize;
    }
    private getInterpolatedNoise(x: number, z: number): number {
        const intX: number = Math.floor(x);
        const intZ: number = Math.floor(z);
        const fracX: number = x - intX;
        const fracZ: number = z - intZ;

        const v1: number = this.getSmoothNoise(intX, intZ);
        const v2: number = this.getSmoothNoise(intX + 1, intZ);
        const v3: number = this.getSmoothNoise(intX, intZ + 1);
        const v4: number = this.getSmoothNoise(intX + 1, intZ + 1);

        const i1: number = this.interpolate(v1, v2, fracX);
        const i2: number = this.interpolate(v3, v4, fracX);
        return this.interpolate(i1, i2, fracZ);
    }
    private interpolate(a: number, b: number, blend: number): number {
        const theta: number = blend * Math.PI;
        const f: number = (1 - Math.cos(theta)) * 0.5;
        return a * (1 - f) + b * f;
    }
    private getSmoothNoise(x: number, z: number): number {
        const corners: number = (this.getNoise(x - 1, z - 1) + this.getNoise(x - 1, z + 1) + this.getNoise(x + 1, z - 1) + this.getNoise(x + 1, z + 1)) / 16;
        const sides: number = (this.getNoise(x - 1, z) + this.getNoise(x, z + 1) + this.getNoise(x + 1, z) + this.getNoise(x, z - 1)) / 8;
        const middle: number = this.getNoise(x, z) / 4;
        return corners + sides + middle;
    }
    public getHeight(x: number, z: number): number {
        var total: number = 0;
        const d: number = Math.pow(2, PerlinNoiseGenerator.OCTAVES - 1);
        for (let i = 0; i < PerlinNoiseGenerator.OCTAVES; i++) {
            const freq: number = Math.pow(2, i) / d;
            const amp: number = Math.pow(PerlinNoiseGenerator.ROUGHNESS, i) * PerlinNoiseGenerator.AMPLITUDE;
            total += this.getInterpolatedNoise(x * freq, z * freq) * amp;
        }
        return total;
    }
    private getNoise(x: number, z: number): number {
        //@ts-ignore
        return (new Math.seedrandom(Math.ceil(x * 123123 + z * 324234 + this.seed)))() * 2 - 1;
    }
}
class TerrainTile {
    vaoID: number;
    textureID: number;
    pos: vec3;
    public static TILE_SIZE: number = 50;
    public createTransformationMatrix(): mat4 {
        //@ts-ignore
        return mat4.translate(mat4.create(), mat4.create(), vec3.negate(vec3.create(), this.pos));
    }
    public static async generateTerrainTile(gl: WebGL2RenderingContext, program: Program, resolution: number, pos: vec3, textureID: number, seed: number): Promise<TerrainTile> {
        return new Promise<TerrainTile>(async (resolve) => {
            /*
            await init();
            let data: Float32Array = generate_terrain_mesh(resolution, TerrainTile.TILE_SIZE);
            const VERTEX_COUNT =  Math.pow(resolution + 1, 2);
            const INDEX_COUNT = Math.pow(resolution, 2) * 6;
            var vertices = get_range_from_array(data, 0, VERTEX_COUNT * 3);
            var normals = get_range_from_array(data, VERTEX_COUNT * 3, VERTEX_COUNT * 6);
            var texCords = get_range_from_array(data, VERTEX_COUNT * 6, VERTEX_COUNT * 8);
            var indices = get_range_from_array(data, VERTEX_COUNT * 8, VERTEX_COUNT * 8 + INDEX_COUNT);
            */
            var terrainTile: TerrainTile = new TerrainTile();
            let VERTICES_PER_ROW: number = resolution + 1;
            let VERTEX_COUNT: number = Math.pow(VERTICES_PER_ROW, 2);
            let QUADS_PER_ROW: number = resolution * 2;

            var vertices: Float32Array = new Float32Array(VERTEX_COUNT * 3);
            var normals: Float32Array = new Float32Array(VERTEX_COUNT * 3);
            var texCords: Float32Array = new Float32Array(VERTEX_COUNT * 2);
            var indices: Uint16Array = new Uint16Array(QUADS_PER_ROW * resolution * 3);

            let STEP_SIZE: number = TerrainTile.TILE_SIZE / resolution;

            var perlinNoiseGenerator: PerlinNoiseGenerator = new PerlinNoiseGenerator(seed, STEP_SIZE);
            for (let Z = 0; Z < VERTICES_PER_ROW; Z++) {
                for (let X = 0; X < VERTICES_PER_ROW; X++) {
                    let INDEX: number = Z + X * VERTICES_PER_ROW;
                    vertices[INDEX * 3] = (X * 2 - 1) * STEP_SIZE;
                    vertices[INDEX * 3 + 1] = perlinNoiseGenerator.getHeight((X) * STEP_SIZE, (Z) * STEP_SIZE);
                    vertices[INDEX * 3 + 2] = (Z * 2 - 1) * STEP_SIZE;

                    texCords[INDEX * 2] = Z * STEP_SIZE;
                    texCords[INDEX * 2 + 1] = X * STEP_SIZE;
                }
            }
            for (let X = 0; X < VERTICES_PER_ROW; X++) {
                for (let Z = 0; Z < VERTICES_PER_ROW; Z++) {
                    let INDEX: number = Z + X * VERTICES_PER_ROW;
                    let heightL: number;
                    let heightR: number;
                    let heightD: number;
                    let heightU: number;
                    if (X == 0 && Z == 0) {
                        heightL = perlinNoiseGenerator.getHeight((X - 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z + 1) * STEP_SIZE);
                    } else if (X == 0 && Z == resolution) {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = perlinNoiseGenerator.getHeight((X + 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z + 1) * STEP_SIZE);
                    } else if (X == resolution && Z == 0) {
                        heightL = perlinNoiseGenerator.getHeight((X - 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z - 1) * STEP_SIZE);
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    } else if (X == resolution && Z == resolution) {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = perlinNoiseGenerator.getHeight((X + 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightD = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z - 1) * STEP_SIZE);
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    } else if (X == 0) {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z + 1) * STEP_SIZE);
                    } else if (X == resolution) {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z - 1) * STEP_SIZE);
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    } else if (Z == 0) {
                        heightL = perlinNoiseGenerator.getHeight((X - 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    } else if (Z == resolution) {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = perlinNoiseGenerator.getHeight((X + 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    } else {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    }
                    //@ts-ignore
                    const normal: vec3 = vec3.normalize(vec3.create(), vec3.fromValues(heightU - heightD, 2, heightL - heightR));
                    normals[INDEX * 3] = normal[0];
                    normals[INDEX * 3 + 1] = normal[1];
                    normals[INDEX * 3 + 2] = normal[2];
                }
            }
            for (let Z = 0; Z < resolution; Z++) {
                for (let X = 0; X < resolution; X++) {
                    let INDEX = Z * resolution + X;
                    let UPPER_LEFT_VERTEX: number = X + Z * VERTICES_PER_ROW;
                    let UPPER_RIGHT_VERTEX: number = UPPER_LEFT_VERTEX + 1;
                    let LOWER_LEFT_VERTEX: number = X + VERTICES_PER_ROW * (Z + 1);
                    let LOWER_RIGHT_VERTEX: number = LOWER_LEFT_VERTEX + 1;

                    indices[INDEX * 6] = UPPER_LEFT_VERTEX;
                    indices[INDEX * 6 + 1] = UPPER_RIGHT_VERTEX;
                    indices[INDEX * 6 + 2] = LOWER_LEFT_VERTEX;
                    indices[INDEX * 6 + 3] = LOWER_LEFT_VERTEX;
                    indices[INDEX * 6 + 4] = UPPER_RIGHT_VERTEX;
                    indices[INDEX * 6 + 5] = LOWER_RIGHT_VERTEX;
                }
            }
            terrainTile.vaoID = await VAO.loadVAOFromArray(gl, true,
                new VBOData(gl, vertices, program, "in_pos", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, normals, program, "in_normal", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, texCords, program, "in_texCord", 2, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, indices, program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true)
            );
            terrainTile.textureID = textureID;
            terrainTile.pos = pos;
            resolve(terrainTile);
        });
    }
}
class GUI {
    pos: vec2;
    texture: number;

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
    static SPEED: number = 20;
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
class EntityRenderer {
    program: Program;
    projectionViewTransformationMatrixLocation: WebGLUniformLocation;
    transformationInverseTransposeMatrixLocation: WebGLUniformLocation;
    reverseLightDirectionLocation: WebGLUniformLocation;
    textureLocation: WebGLUniformLocation;
    entityMap: Map<number, Entity[]>;
    public static async init(gl: WebGL2RenderingContext, programName: string): Promise<EntityRenderer> {
        return new Promise<EntityRenderer>(async (resolve) => {
            var entityRenderer: EntityRenderer = new EntityRenderer();
            entityRenderer.program = await Program.loadProgram(gl, programName);
            entityRenderer.projectionViewTransformationMatrixLocation = entityRenderer.program.getUniformLocation(gl, "u_projectionViewTransformationMatrix");
            entityRenderer.transformationInverseTransposeMatrixLocation = entityRenderer.program.getUniformLocation(gl, "u_transformInverseTransposeMatrix");
            entityRenderer.reverseLightDirectionLocation = entityRenderer.program.getUniformLocation(gl, "u_reverseLightDirection");
            entityRenderer.textureLocation = entityRenderer.program.getUniformLocation(gl, "u_texture");
            resolve(entityRenderer);
        });
    }
    public delete(gl: WebGL2RenderingContext): void {
        this.program.delete(gl);
    }
    private prepareEntities(entities: Entity[]): void {
        this.entityMap = new Map<number, Entity[]>();
        entities.forEach((currentEntity: Entity) => {
            if (!this.entityMap.has(currentEntity.modelID)) {
                this.entityMap.set(currentEntity.modelID, []);
            }
            this.entityMap.get(currentEntity.modelID).push(currentEntity);
        });
    }
    private prepare(gl: WebGL2RenderingContext, entities: Entity[]): void {
        this.prepareEntities(entities);
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        gl.enable(WebGL2RenderingContext.CULL_FACE);
        gl.cullFace(WebGL2RenderingContext.BACK);
        this.program.start(gl);
    }
    private finish(gl: WebGL2RenderingContext): void {
        this.program.stop(gl);
    }
    private loadDataToUniforms(gl: WebGL2RenderingContext, projectionViewMatrix: mat4, light: Light, currentEntity: Entity): void {
        var currentTransformationMatrix: mat4 = currentEntity.createTransformationMatrix();
        //@ts-ignore
        var projectionViewTransformationMatrix: mat4 = mat4.mul(mat4.create(), projectionViewMatrix, currentTransformationMatrix);
        //@ts-ignore
        var transformationInverseMatrix: mat4 = mat4.invert(mat4.create(), currentTransformationMatrix);

        gl.uniformMatrix4fv(this.projectionViewTransformationMatrixLocation, false, projectionViewTransformationMatrix);
        gl.uniformMatrix4fv(this.transformationInverseTransposeMatrixLocation, true, transformationInverseMatrix);
        gl.uniform3fv(this.reverseLightDirectionLocation, light.dir);
    }
    public render(gl: WebGL2RenderingContext, cameraPos: vec3, projectionViewMatrix: mat4, drawMode: number, light: Light, entities: Entity[]): void {
        this.prepare(gl, entities);
        this.entityMap.forEach((currentEntities: Entity[], currentModelID: number) => {
            VAO.getVAO(Model.getModel(currentModelID).vaoID).enableVAO(gl);
            Texture.getTexture(Model.getModel(currentModelID).textureID).activateTexture(gl);
            currentEntities.forEach((currentEntity: Entity) => {
                if (currentEntity.disableBackFaceCulling) {
                    gl.disable(WebGL2RenderingContext.CULL_FACE);
                }
                //@ts-ignore
                if (currentEntity.disableFarPlaneCulling || vec3.distance(cameraPos, currentEntity.pos) > EntityRenderer.FAR_PLANE) {
                    return;
                }
                this.loadDataToUniforms(gl, projectionViewMatrix, light, currentEntity);
                if (VAO.vaos[Model.getModel(currentModelID).vaoID].containsIndexBuffer) {
                    gl.drawElements(drawMode, VAO.vaos[Model.getModel(currentModelID).vaoID].length, gl.UNSIGNED_SHORT, 0);
                } else {
                    gl.drawArrays(drawMode, 0, VAO.vaos[Model.getModel(currentModelID).vaoID].length);
                }
                if (currentEntity.disableBackFaceCulling) {
                    gl.enable(WebGL2RenderingContext.CULL_FACE);
                    gl.cullFace(WebGL2RenderingContext.BACK);
                }
            });
            Texture.getTexture(Model.getModel(currentModelID).textureID).disableTexture(gl);
            VAO.vaos[Model.getModel(currentModelID).vaoID].disableVAO(gl);
        });
        this.finish(gl);
    }
}
class TerrainRenderer {
    program: Program;
    projectionViewTransformationMatrixLocation: WebGLUniformLocation;
    transformationInverseTransposeMatrixLocation: WebGLUniformLocation;
    reverseLightDirectionLocation: WebGLUniformLocation;
    textureLocation: WebGLUniformLocation;
    public static async init(gl: WebGL2RenderingContext, programName: string): Promise<TerrainRenderer> {
        return new Promise<TerrainRenderer>(async (resolve) => {
            var terrainRenderer: TerrainRenderer = new TerrainRenderer();
            terrainRenderer.program = await Program.loadProgram(gl, programName);
            terrainRenderer.projectionViewTransformationMatrixLocation = terrainRenderer.program.getUniformLocation(gl, "u_projectionViewTransformationMatrix");
            terrainRenderer.transformationInverseTransposeMatrixLocation = terrainRenderer.program.getUniformLocation(gl, "u_transformInverseTransposeMatrix");
            terrainRenderer.reverseLightDirectionLocation = terrainRenderer.program.getUniformLocation(gl, "u_reverseLightDirection");
            terrainRenderer.textureLocation = terrainRenderer.program.getUniformLocation(gl, "u_texture");
            resolve(terrainRenderer);
        });
    }
    public delete(gl: WebGL2RenderingContext): void {
        this.program.delete(gl);
    }
    private prepare(gl: WebGL2RenderingContext): void {
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.enable(WebGL2RenderingContext.CULL_FACE);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        gl.cullFace(WebGL2RenderingContext.BACK);
        this.program.start(gl);
    }
    private finish(gl: WebGL2RenderingContext): void {
        this.program.stop(gl);
    }
    private loadDataToUniforms(gl: WebGL2RenderingContext, projectionViewMatrix: mat4, light: Light, currentTile: TerrainTile): void {
        var currentTransformationMatrix: mat4 = currentTile.createTransformationMatrix();
        //@ts-ignore
        var projectionViewTransformationMatrix: mat4 = mat4.mul(mat4.create(), projectionViewMatrix, currentTransformationMatrix);
        //@ts-ignore
        var transformationInverseMatrix: mat4 = mat4.invert(mat4.create(), currentTransformationMatrix);

        gl.uniformMatrix4fv(this.projectionViewTransformationMatrixLocation, false, projectionViewTransformationMatrix);
        gl.uniformMatrix4fv(this.transformationInverseTransposeMatrixLocation, true, transformationInverseMatrix);
        gl.uniform3fv(this.reverseLightDirectionLocation, light.dir);
    }
    public render(gl: WebGL2RenderingContext, projectionViewMatrix: mat4, drawMode: number, light: Light, terrainTiles: TerrainTile[]): void {
        this.prepare(gl);
        terrainTiles.forEach((currentTile: TerrainTile) => {
            if (currentTile == undefined) {
                return;
            }
            VAO.getVAO(currentTile.vaoID).enableVAO(gl);
            Texture.getTexture(currentTile.textureID).activateTexture(gl);
            this.loadDataToUniforms(gl, projectionViewMatrix, light, currentTile)
            gl.drawElements(drawMode, VAO.getVAO(currentTile.vaoID).length, WebGL2RenderingContext.UNSIGNED_SHORT, 0);
            Texture.getTexture(currentTile.textureID).disableTexture(gl);
            VAO.getVAO(currentTile.vaoID).disableVAO(gl);
        });
        this.finish(gl);
    }
}
class MasterRenderer {
    entityRenderer: EntityRenderer;
    terrainRenderer: TerrainRenderer;
    projectionMatrix: mat4;
    drawMode: number;
    static FOV: number = 60;
    static NEAR_PLANE: number = 0.1;
    static FAR_PLANE: number = 100;
    public static async init(gl: WebGL2RenderingContext): Promise<MasterRenderer> {
        return new Promise<MasterRenderer>(async (resolve) => {
            var masterRenderer: MasterRenderer = new MasterRenderer();
            masterRenderer.entityRenderer = await EntityRenderer.init(gl, "entityShader");
            masterRenderer.terrainRenderer = await TerrainRenderer.init(gl, "terrainShader");
            //@ts-ignore
            masterRenderer.projectionMatrix = mat4.create();
            masterRenderer.updateProjectionMatrix(gl);
            masterRenderer.drawMode = WebGL2RenderingContext.TRIANGLES;
            resolve(masterRenderer);
        });
    }
    public static prepareViewport(gl: WebGL2RenderingContext): void {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
    public static clear(gl: WebGL2RenderingContext): void {
        gl.clearColor(1, 1, 1, 1);
        gl.clear(WebGL2RenderingContext.COLOR_BUFFER_BIT);
    }
    public updateProjectionMatrix(gl: WebGL2RenderingContext): void {
        //@ts-ignore
        mat4.perspective(this.projectionMatrix, toRadians(MasterRenderer.FOV), gl.canvas.width / gl.canvas.height, MasterRenderer.NEAR_PLANE, MasterRenderer.FAR_PLANE);
    }
    public render(gl: WebGL2RenderingContext, camera: Camera, light: Light, entities: Entity[], terrainTiles: TerrainTile[]): void {
        MasterRenderer.prepareViewport(gl);
        MasterRenderer.clear(gl);
        camera.updateViewMatrix();
        //@ts-ignore
        var projectionViewMatrix: mat4 = mat4.mul(mat4.create(), this.projectionMatrix, camera.viewMatrix);
        this.terrainRenderer.render(gl, projectionViewMatrix, this.drawMode, light, terrainTiles);
        this.entityRenderer.render(gl, camera.pos, projectionViewMatrix, this.drawMode, light, entities);
    }
}
async function loadImage(imageName: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve) => {
        var image: HTMLImageElement = new Image();
        image.src = imageName;
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

async function updateEntities(entities: Entity[], deltaTime: number): Promise<void> {
    entities.forEach((currentEntity: Entity) => {
        currentEntity.update(deltaTime);
    });
}
async function main(): Promise<void> {
    var gl: WebGL2RenderingContext = await createContext();

    var renderer: MasterRenderer = await MasterRenderer.init(gl);

    //@ts-ignore
    var camera: Camera = new Camera(vec3.fromValues(0, -1, 0), vec3.fromValues(0, 0, 0));

    //@ts-ignore
    var sun: Light = new Light(vec3.fromValues(5, 7, 10));

    var tile: TerrainTile;
    TerrainTile.generateTerrainTile(gl, renderer.terrainRenderer.program, 1, [0, 0, 0], await Texture.loadTexture(gl, "grass.jpg"), 3157).then((terrainTile: TerrainTile) => {
        tile = terrainTile;
    });

    var entity: number = await Model.loadModelWithSeperateResources(gl, renderer.entityRenderer.program, "cube", "uvgrid");
    var entity2: number = await Model.loadModel(gl, renderer.entityRenderer.program, "screen");
    var entities: Entity[] = [];
    entities.push(new Entity(entity, [0, 0, 6], [0, 0, 0]));
    entities.push(new Entity(entity2, [0, 0, 12], [0, 0, 0], true));
    var then: number = millisToSeconds(Date.now());
    var deltaTime: number;
    var isPointerLocked: boolean = false;

    document.getElementById("webgl_canvas").onresize = () => {
        renderer.updateProjectionMatrix(gl);
    };
    window.onkeydown = async (ev: KeyboardEvent) => {
        if (ev.code === "KeyC") {
            camera.pos[1] += Camera.SPEED * deltaTime;
        } else if (ev.code === "Space") {
            camera.pos[1] -= Camera.SPEED * deltaTime;
        }
        if (ev.code === "KeyW") {
            let distance: number = Camera.SPEED * deltaTime;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1]));
        } else if (ev.code === "KeyS") {
            let distance: number = Camera.SPEED * deltaTime;
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1]));
        }
        if (ev.code === "KeyA") {
            let distance: number = Camera.SPEED * deltaTime;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1] + 90));
        } else if (ev.code === "KeyD") {
            let distance: number = Camera.SPEED * deltaTime;
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
        if (ev.code === "KeyM") {
            renderer.drawMode = (renderer.drawMode === WebGL2RenderingContext.TRIANGLES) ? WebGL2RenderingContext.LINE_LOOP : WebGL2RenderingContext.TRIANGLES;
        }
    };
    document.onpointerlockchange = () => {
        isPointerLocked = !isPointerLocked;
    };
    window.onmousemove = (ev: MouseEvent) => {
        if (isPointerLocked) {
            camera.rot[1] -= ev.movementX / gl.canvas.width * 180;
        }
    };
    window.requestAnimationFrame(mainLoop);
    function mainLoop(): void {
        deltaTime = millisToSeconds(Date.now()) - then;
        then = millisToSeconds(Date.now());
        gl.canvas.width = window.innerWidth;
        gl.canvas.height = window.innerHeight;
        updateEntities(entities, deltaTime);
        renderer.render(gl, camera, sun, entities, [tile]);
        window.requestAnimationFrame(mainLoop);
    }
}
document.body.onload = main;
