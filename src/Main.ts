//@ts-ignore
import type { vec2, vec3, vec4, mat2, mat3, mat4, glMatrix, quat } from "gl-matrix";
//@ts-ignore
const { vec2, vec3, vec4, mat2, mat3, mat4, quat } = glMatrix;
//This class abstracts a WebGL Shader Program
class Program {
    shaders: WebGLShader[];
    program: WebGLProgram;
    //Tell WebGL to use the program
    public start(gl: WebGL2RenderingContext): void {
        gl.useProgram(this.program);
    }
    //Tell WebGL to stop using the program
    public stop(gl: WebGL2RenderingContext): void {
        gl.useProgram(null);
    }
    //Retrive a uniformlocation from the program
    public getUniformLocation(gl: WebGL2RenderingContext, name: string): WebGLUniformLocation {
        return gl.getUniformLocation(this.program, name);
    }
    //Delete the program
    public delete(gl: WebGL2RenderingContext) {
        gl.deleteProgram(this.program);
    }
    //Load a shader from the res/shaders folder
    private static async loadShader(gl: WebGL2RenderingContext, name: string, shaderType: number): Promise<WebGLShader> {
        return new Promise<WebGLShader>(async (resolve, reject) => {
            var shader: WebGLShader = gl.createShader(shaderType);
            gl.shaderSource(shader, `#version 300 es
            ${await loadFile(`res/shaders/${name}`)}`);
            gl.compileShader(shader);
            if (gl.getShaderParameter(shader, WebGL2RenderingContext.COMPILE_STATUS)) {
                resolve(shader);
            } else {
                let shaderInfoLog: string = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                reject(new Error(`${shaderType == WebGL2RenderingContext.VERTEX_SHADER ? "Vertex Shader: " : "Fragment Shader: "}${shaderInfoLog}`));
            }
        })
    }
    //Load a Program of two Shaders
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
//This is a data class
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
//Abstracts a WebGL vertexbufferobject
class VBO {
    vboData: VBOData;
    vbo: WebGLBuffer;
    //Bind the VBO
    public bindVBO(gl: WebGL2RenderingContext): void {
        gl.bindBuffer((this.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), this.vbo);
    }
    //Unbind the VBO
    public unbindVBO(gl: WebGL2RenderingContext): void {
        gl.bindBuffer((this.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), null);
    }
    //Enable the VBO
    public enableVBO(gl: WebGL2RenderingContext): void {
        if (this.vboData.isIndexBuffer) {
            this.bindVBO(gl);
        } else {
            gl.enableVertexAttribArray(this.vboData.attribLocation);
        }
    }
    //Disable the VBO
    public disableVBO(gl: WebGL2RenderingContext): void {
        if (this.vboData.isIndexBuffer) {
            this.unbindVBO(gl);
        } else {
            gl.disableVertexAttribArray(this.vboData.attribLocation);
        }
    }
    //Delete the VBO
    public delete(gl: WebGL2RenderingContext): void {
        gl.deleteBuffer(this.vbo);
    }
    //Load a VBO from a VBOData object
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
//Abstracts a WebGL vertexarrayobject
class VAO {
    vbos: VBO[];
    vao: WebGLVertexArrayObject;
    length: number;
    containsIndexBuffer: boolean;
    static vaos: VAO[] = [];
    //Bind the VAO
    public bindVAO(gl: WebGL2RenderingContext): void {
        gl.bindVertexArray(this.vao);
    }
    //Unbind the VAO
    public unbindVAO(gl: WebGL2RenderingContext): void {
        gl.bindVertexArray(null);
    }
    //Enable the VAO
    public enableVAO(gl: WebGL2RenderingContext): void {
        this.bindVAO(gl);
        this.vbos.forEach((currentVBO: VBO) => {
            currentVBO.enableVBO(gl);
        });
    }
    //Disable the VAO
    public disableVAO(gl: WebGL2RenderingContext): void {
        this.vbos.reverse().forEach((currentVBO: VBO) => {
            currentVBO.disableVBO(gl);
        });
        this.unbindVAO(gl);
    }
    //Delete the VAO and the VBOs associated with it
    public delete(gl: WebGL2RenderingContext): void {
        this.vbos.reverse().forEach((currentVBO: VBO) => {
            currentVBO.delete(gl);
        });
        gl.deleteVertexArray(this.vao);
    }
    //Deletes all global VAOs
    public static deleteALL(gl: WebGL2RenderingContext): void {
        VAO.vaos.reverse().forEach((currentVAO: VAO) => {
            currentVAO.delete(gl);
        });
    }
    //Returns a VAO from its index;
    public static getVAO(vaoID: number): VAO {
        return VAO.vaos[vaoID];
    }
    //Loads a VAO from a Wavefront OBJ file(https://en.wikipedia.org/wiki/Wavefront_.obj_file)(unused)
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
                processedTextureCords.push(1 - textureCords[currentTexCord][1]);
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
                new VBOData(gl, new Float32Array(processedVertices), program, "POSITION", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, new Float32Array(processedNormals), program, "NORMAL", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, new Float32Array(processedTextureCords), program, "TEXCOORD_0", 2, WebGL2RenderingContext.FLOAT)
            ));
        });
    }
    //Loads a VAO from a variable array of VBOData objects
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
//Abstracts a WebGL texture
class Texture {
    texture: WebGLTexture;
    static activeTextures: number = 0;
    static textures: Texture[] = [];
    //Tell WebGL to use the current texture
    public activateTexture(gl: WebGL2RenderingContext): void {
        gl.activeTexture(WebGL2RenderingContext.TEXTURE0 + Texture.activeTextures);
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, this.texture);
        Texture.activeTextures++;
    }
    //Tell WebGL to stop using the current texture
    public disableTexture(gl: WebGL2RenderingContext): void {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, null);
        Texture.activeTextures--;
    }
    //Bind the texture
    public bindTexture(gl: WebGL2RenderingContext): void {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, this.texture);
    }
    //Unbind the Texture
    public unbindTexture(gl: WebGL2RenderingContext): void {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, null);
    }
    //Delete the Texture
    public delete(gl: WebGL2RenderingContext): void {
        gl.deleteTexture(this.texture);
    }
    //Delete all global textures
    public static deleteALL(gl: WebGL2RenderingContext): void {
        Texture.textures.reverse().forEach((currentTexture: Texture) => {
            currentTexture.delete(gl);
        });
    }
    //Returns a texture from its index
    public static getTexture(textureID: number): Texture {
        return Texture.textures[textureID];
    }
    //Load a texture from the res/assets folder
    public static async loadTexture(gl: WebGL2RenderingContext, textureName: string): Promise<number> {
        return new Promise<number>(async (resolve) => {
            var texture: Texture = new Texture();
            texture.texture = gl.createTexture();
            texture.bindTexture(gl);
            var image: HTMLImageElement = await loadImage(`res/assets/${textureName}`);
            gl.texImage2D(WebGL2RenderingContext.TEXTURE_2D, 0, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.UNSIGNED_BYTE, image);
            gl.generateMipmap(WebGL2RenderingContext.TEXTURE_2D);
            let ext: EXT_texture_filter_anisotropic = gl.getExtension("EXT_texture_filter_anisotropic");
            gl.texParameterf(WebGL2RenderingContext.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
            texture.unbindTexture(gl);
            Texture.textures.push(texture);
            resolve(Texture.textures.length - 1);
        });
    }
}
//Contains data about a model
class Model {
    vaoID: number;
    textureID: number;
    static models: Model[] = [];
    static testTexture: number = -1;
    constructor(vaoID: number, textureID: number = -1) {
        this.vaoID = vaoID;
        this.textureID = textureID == -1 ? Model.testTexture : textureID;
    }
    //Create a test texture
    private static async initTestTexture(gl: WebGL2RenderingContext): Promise<void> {
        Model.testTexture = await Texture.loadTexture(gl, "uvgrid.jpg");
    }
    //Return a model from its index
    public static getModel(modelID: number): Model {
        return Model.models[modelID];
    }
    //Load a model which uses a model and a texture with the same filename
    public static async loadModel(gl: WebGL2RenderingContext, program: Program, name: string): Promise<number> {
        return new Promise<number>(async (resolve) => {
            if (this.testTexture == -1) {
                await Model.initTestTexture(gl);
            }
            Model.models.push(new Model(await VAO.loadVAOFromOBJFile(gl, program, name), await Texture.loadTexture(gl, `${name}.png`)));
            resolve(Model.models.length - 1);
        });
    }
    //Load a model while setting the texture to the test texture
    public static async loadModelWithoutTexture(gl: WebGL2RenderingContext, program: Program, name: string): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            if (this.testTexture == -1) {
                await Model.initTestTexture(gl);
            }
            Model.models.push(new Model(await VAO.loadVAOFromOBJFile(gl, program, name)));
            resolve(Model.models.length - 1);
        });
    }
    //Load a model which model and texture files have diffrent names
    public static async loadModelWithSeperateResources(gl: WebGL2RenderingContext, program: Program, modelName: string, textureName: string): Promise<number> {
        return new Promise<number>(async (resolve) => {
            if (this.testTexture == -1) {
                await Model.initTestTexture(gl);
            }
            Model.models.push(new Model(await VAO.loadVAOFromOBJFile(gl, program, modelName), await Texture.loadTexture(gl, textureName)));
            resolve(Model.models.length - 1);
        });
    }
    //Load a model by setting a custom VAOID
    public static async loadWithCustomVAO(gl: WebGL2RenderingContext, program: Program, vaoID: number): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            if (this.testTexture == -1) {
                await Model.initTestTexture(gl);
            }
            Model.models.push(new Model(vaoID, Model.testTexture));
            resolve(Model.models.length - 1);
        });
    }
    //Load a model by setting a custom VAOID and TextureID 
    public static async loadWithCustomVAOAndTexture(gl: WebGL2RenderingContext, program: Program, vaoID: number, textureID: number): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            if (this.testTexture == -1) {
                await Model.initTestTexture(gl);
            }
            Model.models.push(new Model(vaoID, textureID));
            resolve(Model.models.length - 1);
        });
    }
}
//Stores data about an Entity
class Entity {
    modelID: number;
    pos: vec3;
    rot: quat;
    scl: vec3;
    disableFarPlaneCulling: boolean;
    disableBackFaceCulling: boolean;
    disableLighting: boolean;
    static G = 9.81;
    constructor(modelID: number, pos: vec3, rot: quat, scl: vec3, disableBackFaceCulling: boolean = false, disableFarPlaneCulling: boolean = false, disableLighting: boolean = false) {
        this.modelID = modelID;
        this.pos = pos;
        this.rot = rot;
        this.scl = scl;
        //TODO: This is terrible
        this.disableFarPlaneCulling = disableFarPlaneCulling;
        this.disableBackFaceCulling = disableBackFaceCulling;
        this.disableLighting = disableLighting;
    }
    //Apply gravity to the Entity
    public update(deltaTime: number): void {
        if (this.pos[1] >= 0) {
            this.pos[1] -= Entity.G * deltaTime;
        }
    }
    //Generate the transformation matrix
    public createTransformationMatrix(): mat4 {
        //@ts-ignore
        var transformationMatrix: mat4 = mat4.create();
        //@ts-ignore
        mat4.fromRotationTranslationScale(transformationMatrix, this.rot, this.pos, this.scl);
        return transformationMatrix;
    }
}
//Implements the perlin noise algorithm(https://en.wikipedia.org/wiki/Perlin_noise)
class PerlinNoiseGenerator {
    seed: number;
    stepSize: number;
    private static AMPLITUDE: number = 1;
    private static OCTAVES: number = 2;
    private static ROUGHNESS: number = 0.3;
    constructor(seed: number, stepSize: number) {
        this.seed = seed;
        this.stepSize = stepSize;
    }
    //Get interpolated noise at this position
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
    //Cosine interpolation(http://paulbourke.net/miscellaneous/interpolation/)
    private interpolate(a: number, b: number, blend: number): number {
        const theta: number = blend * Math.PI;
        const f: number = (1 - Math.cos(theta)) * 0.5;
        return a * (1 - f) + b * f;
    }
    //Get smooth noise at this position
    private getSmoothNoise(x: number, z: number): number {
        const corners: number = (this.getNoise(x - 1, z - 1) + this.getNoise(x - 1, z + 1) + this.getNoise(x + 1, z - 1) + this.getNoise(x + 1, z + 1)) / 16;
        const sides: number = (this.getNoise(x - 1, z) + this.getNoise(x, z + 1) + this.getNoise(x + 1, z) + this.getNoise(x, z - 1)) / 8;
        const middle: number = this.getNoise(x, z) / 4;
        return corners + sides + middle;
    }
    //Get combined height at this position
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
    //Get noise at this position
    private getNoise(x: number, z: number): number {
        //@ts-ignore
        return (new Math.seedrandom(Math.ceil(x * 123123 + z * 324234 + this.seed)))() * 2 - 1;
    }
}
//Terrain tile
class TerrainTile {
    vaoID: number;
    textureID: number;
    pos: vec3;
    public static TILE_SIZE: number = 20;
    //Generate a transformation matrix
    public createTransformationMatrix(): mat4 {
        //@ts-ignore
        return mat4.translate(mat4.create(), mat4.create(), this.pos);
    }
    //Generate a terrain tile with perlin noise
    public static async generateTerrainTile(gl: WebGL2RenderingContext, program: Program, resolution: number, pos: vec3, textureID: number, seed: number): Promise<TerrainTile> {
        return new Promise<TerrainTile>(async (resolve) => {
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
//Directional light(https://www.pluralsight.com/blog/film-games/understanding-different-light-types)
class DirectionalLight {
    dir: vec3;
    constructor(dir: vec3) {
        //@ts-ignore
        this.dir = vec3.normalize(vec3.create(), dir);
    }
}
//Point light(https://www.pluralsight.com/blog/film-games/understanding-different-light-types)
class PointLight {
    pos: vec3;
    constructor(pos: vec3) {
        this.pos = pos;
    }
}
//Camera 
class Camera {
    rot: vec3;
    pos: vec3;
    viewMatrix: mat4;
    static SPEED: number = 20;
    constructor(pos: vec3, rot: vec3) {
        this.rot = rot;
        this.pos = pos;
    }
    //Update the view matrix
    public updateViewMatrix(): void {
        //@ts-ignore
        this.viewMatrix = mat4.identity(mat4.create());
        //@ts-ignore
        mat4.translate(this.viewMatrix, this.viewMatrix, this.pos);
        //@ts-ignore
        rotateXYZ(this.viewMatrix, this.rot);
        //@ts-ignore
        this.viewMatrix = mat4.invert(this.viewMatrix, this.viewMatrix);
    }
}
//Entityrenderer
class EntityRenderer {
    program: Program;
    lightCountLocation: WebGLUniformLocation;
    lightPositionsLocation: WebGLUniformLocation;
    viewWorldPositionLocation: WebGLUniformLocation;
    worldMatrixLocation: WebGLUniformLocation;
    projectionViewMatrixLocation: WebGLUniformLocation;
    reverseLightDirectionLocation: WebGLUniformLocation;
    textureLocation: WebGLUniformLocation;
    disableLightingLocation: WebGLUniformLocation;
    entityMap: Map<number, Entity[]>;
    lightDataArray: Float32Array;
    //Loads the program and retreives the uniform locations
    public static async init(gl: WebGL2RenderingContext, programName: string): Promise<EntityRenderer> {
        return new Promise<EntityRenderer>(async (resolve) => {
            var entityRenderer: EntityRenderer = new EntityRenderer();
            entityRenderer.program = await Program.loadProgram(gl, programName);

            entityRenderer.lightCountLocation = entityRenderer.program.getUniformLocation(gl, "u_lightCount");
            entityRenderer.lightPositionsLocation = entityRenderer.program.getUniformLocation(gl, "u_lightPositions");
            entityRenderer.viewWorldPositionLocation = entityRenderer.program.getUniformLocation(gl, "u_viewWorldPosition");
            entityRenderer.worldMatrixLocation = entityRenderer.program.getUniformLocation(gl, "u_world");
            entityRenderer.projectionViewMatrixLocation = entityRenderer.program.getUniformLocation(gl, "u_projectionView");
            entityRenderer.reverseLightDirectionLocation = entityRenderer.program.getUniformLocation(gl, "u_reverseLightDirection");
            entityRenderer.textureLocation = entityRenderer.program.getUniformLocation(gl, "u_texture");
            entityRenderer.disableLightingLocation = entityRenderer.program.getUniformLocation(gl, "u_disableLighting");

            resolve(entityRenderer);
        });
    }
    //Delete the program
    public delete(gl: WebGL2RenderingContext): void {
        this.program.delete(gl);
    }
    //Sort the entities with shared modelid's to reduce bind calls
    public prepareEntities(entities: Entity[]): void {
        this.entityMap = new Map<number, Entity[]>();
        entities.forEach((currentEntity: Entity) => {
            if (!this.entityMap.has(currentEntity.modelID)) {
                this.entityMap.set(currentEntity.modelID, []);
            }
            this.entityMap.get(currentEntity.modelID).push(currentEntity);
        });
    }
    //Prepare the light data for WebGL
    private prepareLights(lights: PointLight[]): void {
        this.lightDataArray = new Float32Array(8 * 3);
        for (let index = 0; index < 8; index++) {
            if (index >= lights.length) {
                this.lightDataArray[index * 3] = 0;
                this.lightDataArray[index * 3 + 1] = 0;
                this.lightDataArray[index * 3 + 2] = 0;
            } else {
                this.lightDataArray[index * 3] = lights[index].pos[0];
                this.lightDataArray[index * 3 + 1] = lights[index].pos[1];
                this.lightDataArray[index * 3 + 2] = lights[index].pos[2];
            }
        }
    }
    //Prepare entities, lights, enable depthtesting and backface culling
    private prepare(gl: WebGL2RenderingContext, scene: Scene): void {
        this.prepareEntities(scene.entities);
        this.prepareLights(scene.lights);
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        gl.enable(WebGL2RenderingContext.CULL_FACE);
        gl.cullFace(WebGL2RenderingContext.BACK);
        this.program.start(gl);
    }
    //Stop the program
    private finish(gl: WebGL2RenderingContext): void {
        this.program.stop(gl);
    }
    //Load the entity data to the uniforms
    private loadDataToUniforms(gl: WebGL2RenderingContext, projectionViewMatrix: mat4, sun: DirectionalLight, currentEntity: Entity, lightCount: number, cameraPos: vec3): void {
        gl.uniform1i(this.lightCountLocation, lightCount);
        gl.uniform3fv(this.lightPositionsLocation, this.lightDataArray);
        gl.uniform3fv(this.viewWorldPositionLocation, cameraPos);
        gl.uniformMatrix4fv(this.worldMatrixLocation, false, currentEntity.createTransformationMatrix());
        gl.uniformMatrix4fv(this.projectionViewMatrixLocation, false, projectionViewMatrix);
        gl.uniform3fv(this.reverseLightDirectionLocation, sun.dir);
        gl.uniform1i(this.disableLightingLocation, currentEntity.disableLighting ? 1 : 0);
    }
    //Render the scene
    public render(gl: WebGL2RenderingContext, cameraPos: vec3, projectionViewMatrix: mat4, drawMode: number, sun: DirectionalLight, scene: Scene): void {
        this.prepare(gl, scene);
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
                this.loadDataToUniforms(gl, projectionViewMatrix, sun, currentEntity, scene.lights.length, cameraPos);
                if (VAO.vaos[Model.getModel(currentModelID).vaoID].containsIndexBuffer) {
                    gl.drawElements(drawMode, VAO.vaos[Model.getModel(currentModelID).vaoID].length, WebGL2RenderingContext.UNSIGNED_SHORT, 0);
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
//Terrainrenderer
class TerrainRenderer {
    program: Program;
    projectionViewTransformationMatrixLocation: WebGLUniformLocation;
    transformationInverseTransposeMatrixLocation: WebGLUniformLocation;
    reverseLightDirectionLocation: WebGLUniformLocation;
    textureLocation: WebGLUniformLocation;
    //Initialize the program and the uniforms
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
    //Delete the program
    public delete(gl: WebGL2RenderingContext): void {
        this.program.delete(gl);
    }
    //Enable depthtesting and backface culling
    private prepare(gl: WebGL2RenderingContext): void {
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.enable(WebGL2RenderingContext.CULL_FACE);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        gl.cullFace(WebGL2RenderingContext.BACK);
        this.program.start(gl);
    }
    //Stop the shader
    private finish(gl: WebGL2RenderingContext): void {
        this.program.stop(gl);
    }
    //Load the terrain tile data to the uniforms
    private loadDataToUniforms(gl: WebGL2RenderingContext, projectionViewMatrix: mat4, sun: DirectionalLight, currentTile: TerrainTile): void {
        var currentTransformationMatrix: mat4 = currentTile.createTransformationMatrix();
        //@ts-ignore
        var projectionViewTransformationMatrix: mat4 = mat4.mul(mat4.create(), projectionViewMatrix, currentTransformationMatrix);
        //@ts-ignore
        var transformationInverseMatrix: mat4 = mat4.invert(mat4.create(), currentTransformationMatrix);

        gl.uniformMatrix4fv(this.projectionViewTransformationMatrixLocation, false, projectionViewTransformationMatrix);
        gl.uniformMatrix4fv(this.transformationInverseTransposeMatrixLocation, true, transformationInverseMatrix);
        gl.uniform3fv(this.reverseLightDirectionLocation, sun.dir);
    }
    //Render the terrain tiles
    public render(gl: WebGL2RenderingContext, projectionViewMatrix: mat4, drawMode: number, sun: DirectionalLight, terrainTiles: TerrainTile[]): void {
        this.prepare(gl);
        terrainTiles.forEach((currentTile: TerrainTile) => {
            if (currentTile == undefined) {
                return;
            }
            VAO.getVAO(currentTile.vaoID).enableVAO(gl);
            Texture.getTexture(currentTile.textureID).activateTexture(gl);
            this.loadDataToUniforms(gl, projectionViewMatrix, sun, currentTile)
            gl.drawElements(drawMode, VAO.getVAO(currentTile.vaoID).length, WebGL2RenderingContext.UNSIGNED_SHORT, 0);
            Texture.getTexture(currentTile.textureID).disableTexture(gl);
            VAO.getVAO(currentTile.vaoID).disableVAO(gl);
        });
        this.finish(gl);
    }
}
//All renderers in one
class MasterRenderer {
    entityRenderer: EntityRenderer;
    terrainRenderer: TerrainRenderer;
    projectionMatrix: mat4;
    drawMode: number;
    static FOV: number = 60;
    static NEAR_PLANE: number = 0.1;
    static FAR_PLANE: number = 100;
    //Load the programs and create the projection matrix
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
    //Prepare the viewport
    public static prepareViewport(gl: WebGL2RenderingContext): void {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
    //Clear the screeb
    public static clear(gl: WebGL2RenderingContext): void {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(WebGL2RenderingContext.COLOR_BUFFER_BIT);
    }
    //Update the projection matrix
    public updateProjectionMatrix(gl: WebGL2RenderingContext): void {
        //@ts-ignore
        mat4.perspective(this.projectionMatrix, toRadians(MasterRenderer.FOV), gl.canvas.width / gl.canvas.height, MasterRenderer.NEAR_PLANE, MasterRenderer.FAR_PLANE);
    }
    //Render the scene and terrain tiles
    public renderScene(gl: WebGL2RenderingContext, camera: Camera, sun: DirectionalLight, scene: Scene, terrainTiles: TerrainTile[]): void {
        MasterRenderer.prepareViewport(gl);
        MasterRenderer.clear(gl);
        camera.updateViewMatrix();
        //@ts-ignore
        var projectionViewMatrix: mat4 = mat4.mul(mat4.create(), this.projectionMatrix, camera.viewMatrix);
        this.terrainRenderer.render(gl, projectionViewMatrix, this.drawMode, sun, terrainTiles);
        this.entityRenderer.render(gl, camera.pos, projectionViewMatrix, this.drawMode, sun, scene);
    }
    //Delete all renderers
    public delete(gl: WebGL2RenderingContext): void{
        this.terrainRenderer.delete(gl);
        this.entityRenderer.delete(gl);
    }
}
//GLTF-STUFF STARTS HERE(https://en.wikipedia.org/wiki/GlTF)
//gltf buffer
class Buffer {
    byteLength: number;
    arrayBuffer: ArrayBuffer;
    constructor(byteLength: number, arrayBuffer: ArrayBuffer) {
        this.byteLength = byteLength;
        this.arrayBuffer = arrayBuffer;
    }
    //Retrive a binary buffer from res/assets
    public static async loadBuffer(bufferInfo): Promise<Buffer> {
        return new Promise<Buffer>(async (resolve, reject) => {
            resolve(new Buffer(bufferInfo.byteLength, await (await fetch(`res/assets/${bufferInfo.uri}`)).arrayBuffer()));
        });
    }
    //Return a view of a data range from the arraybuffer
    public getDataFromAccessor(accessor: Accessor, gltf: glTF): Float32Array | Uint16Array {
        return accessor.componentType == 5126 ? new Float32Array(this.arrayBuffer, gltf.bufferViews[accessor.bufferView].byteOffset, gltf.bufferViews[accessor.bufferView].byteLength / 4) : new Uint16Array(this.arrayBuffer, gltf.bufferViews[accessor.bufferView].byteOffset, gltf.bufferViews[accessor.bufferView].byteLength / 2);
    }
}
//gltf bufferview
class BufferView {
    buffer: number;
    byteLength: number;
    byteOffset: number;
    constructor(bufferViewInfo) {
        this.buffer = bufferViewInfo.buffer;
        this.byteLength = bufferViewInfo.byteLength;
        this.byteOffset = bufferViewInfo.byteOffset;
    }
}
//gltf accessor
class Accessor {
    bufferView: number;
    componentType: number;
    count: number;
    type: string;
    constructor(accessorInfo) {
        this.bufferView = accessorInfo.bufferView;
        this.componentType = accessorInfo.componentType;
        this.count = accessorInfo.count;
        this.type = accessorInfo.type;
    }
}
//gltf primitive
class Primitive {
    attributes: number[];
    indexAccessor: number;
    material: number;
    constructor(primitiveInfo) {
        this.attributes = [];
        for (const key in primitiveInfo.attributes) {
            this.attributes.push(primitiveInfo.attributes[key]);
        }
        this.indexAccessor = primitiveInfo.indices;
        this.material = primitiveInfo.material;
    }
}
//gltf mesh
class Mesh {
    name: string;
    primitive: Primitive;
    vaoID: number;
    textureID: number;
    constructor(meshInfo) {
        this.name = meshInfo.name;
        this.primitive = new Primitive(meshInfo.primitives[0]);
        this.vaoID = -1;
        this.textureID = -1;
    }
    //Load the data to a VAO
    public async load(gl: WebGL2RenderingContext, program: Program, gltf: glTF): Promise<void> {
        if (this.vaoID == -1) {
            let positionAccessor: Accessor = gltf.accessors[this.primitive.attributes[0]];
            let normalAccessor: Accessor = gltf.accessors[this.primitive.attributes[1]];
            let texCoordAccessor: Accessor = gltf.accessors[this.primitive.attributes[2]];
            let indexAccessor: Accessor = gltf.accessors[this.primitive.indexAccessor];
            let positionBufferView: BufferView = gltf.bufferViews[positionAccessor.bufferView];
            let normalBufferView: BufferView = gltf.bufferViews[normalAccessor.bufferView];
            let texCoordBufferView: BufferView = gltf.bufferViews[texCoordAccessor.bufferView];
            let indexBufferView: BufferView = gltf.bufferViews[indexAccessor.bufferView];
            this.vaoID = await VAO.loadVAOFromArray(gl, false,
                new VBOData(gl, gltf.buffers[positionBufferView.buffer].getDataFromAccessor(positionAccessor, gltf), program, "POSITION", 3, positionAccessor.componentType),
                new VBOData(gl, gltf.buffers[normalBufferView.buffer].getDataFromAccessor(normalAccessor, gltf), program, "NORMAL", 3, positionAccessor.componentType),
                new VBOData(gl, gltf.buffers[texCoordBufferView.buffer].getDataFromAccessor(texCoordAccessor, gltf), program, "TEXCOORD_0", 2, positionAccessor.componentType),
                new VBOData(gl, gltf.buffers[indexBufferView.buffer].getDataFromAccessor(indexAccessor, gltf), program, "", 1, positionAccessor.componentType, true)
            );
            this.textureID = await Texture.loadTexture(gl, gltf.textures[this.primitive.material]);
        } else {
            console.warn("Mesh already loaded!");
        }
    }
    //Delete the VAO
    public unload(gl: WebGL2RenderingContext): void {
        if (this.vaoID == -1) {
            throw new Error("Can't unload mesh when it's not loaded!");
        }
        VAO.getVAO(this.vaoID).delete(gl);
        this.vaoID = -1;
    }
}
//gltf node
class Node {
    mesh: number;
    camera: number;
    name: string;
    type: number;
    rotation: vec3;
    scale: vec3;
    translation: vec3;
    constructor(nodeInfos, currentNodeInfo: number, gltf: glTF) {
        this.name = nodeInfos[currentNodeInfo].name;
        this.mesh = "mesh" in nodeInfos[currentNodeInfo] ? nodeInfos[currentNodeInfo].mesh : -1;
        if (this.name.startsWith("Light") || this.name.startsWith("Point")) {
            this.type = 1;
        } else if ("camera" in nodeInfos) {
            this.type = 3;
            this.camera = nodeInfos.camera;
        } else if (this.name.startsWith("Camera")) {
            this.type = 2;
        } else {
            this.type = 0;
            this.mesh = gltf.uniqueMeshes.get(this.name.split(".")[0]);
        }
        //@ts-ignore
        this.rotation = nodeInfos[currentNodeInfo].rotation ? quat.fromValues(nodeInfos[currentNodeInfo].rotation[0], nodeInfos[currentNodeInfo].rotation[1], nodeInfos[currentNodeInfo].rotation[2], nodeInfos[currentNodeInfo].rotation[3]) : quat.fromEuler(quat.create(), 0, 0, 0);
        //@ts-ignore
        this.scale = nodeInfos[currentNodeInfo].scale ? vec3.fromValues(nodeInfos[currentNodeInfo].scale[0], nodeInfos[currentNodeInfo].scale[1], nodeInfos[currentNodeInfo].scale[2]) : vec3.fromValues(1, 1, 1);
        //@ts-ignore
        this.translation = nodeInfos[currentNodeInfo].translation ? vec3.fromValues(nodeInfos[currentNodeInfo].translation[0], nodeInfos[currentNodeInfo].translation[1], nodeInfos[currentNodeInfo].translation[2]) : vec3.fromValues(0, 0, 0);
    }
}
//gltf scene
class Scene {
    name: string;
    entityNodes: Node[];
    lightNodes: Node[];
    cameraNodes: Node[];
    entities: Entity[];
    lights: PointLight[];
    cameras: Camera[];
    currentCamera: number;
    constructor(sceneInfo, nodes: Node[]) {
        this.name = sceneInfo.name;
        this.entityNodes = [];
        this.lightNodes = [];
        this.cameraNodes = [];
        this.entities = [];
        this.lights = [];
        this.cameras = [];
        sceneInfo.nodes.forEach((currentNode: number) => {
            if (nodes[currentNode].type == 0) {
                this.entityNodes.push(nodes[currentNode]);
            } else if (nodes[currentNode].type == 1) {
                this.lightNodes.push(nodes[currentNode]);
            } else if (nodes[currentNode].type == 2) {
                this.cameraNodes.push(nodes[currentNode]);
            }
        });
        this.currentCamera = 0;
    }
    //Load all entities and lights
    public async load(gl: WebGL2RenderingContext, program: Program, gltf: glTF): Promise<void> {
        for (let [key, value] of gltf.uniqueMeshes){
            await gltf.meshes[value].load(gl, program, gltf);
            gltf.uniqueModels.set(value, await Model.loadWithCustomVAOAndTexture(gl, program, gltf.meshes[value].vaoID, gltf.meshes[value].textureID));
        }
        for (let currentEntityNode of this.entityNodes) {
            //@ts-ignore
            this.entities.push(new Entity(gltf.uniqueModels.get(currentEntityNode.mesh), currentEntityNode.translation, currentEntityNode.rotation, currentEntityNode.scale, true, false, currentEntityNode.name == "skybox"));
        }
        this.lightNodes.forEach((currentLightNode: Node) => {
            this.lights.push(new PointLight(currentLightNode.translation));
        });
    }
}
//All gltf objects
class glTF {
    buffers: Buffer[];
    textures: string[];
    bufferViews: BufferView[];
    accessors: Accessor[];
    meshes: Mesh[];
    uniqueMeshes: Map<string, number>;
    uniqueModels: Map<number, number>;
    nodes: Node[];
    scenes: Scene[];
    currentScene: number;
    constructor() {
        this.buffers = [];
        this.textures = [];
        this.bufferViews = [];
        this.accessors = [];
        this.meshes = [];
        this.uniqueMeshes = new Map<string, number>();
        this.uniqueModels = new Map<number, number>();
        this.nodes = [];
        this.scenes = [];
    }
    //Parse a gltf file
    public static async loadGLTFFile(uri: string): Promise<glTF> {
        return new Promise<glTF>(async (resolve, reject) => {
            let glTFJSON = await (await fetch(uri)).json();
            let tempGLTF: glTF = new glTF();
            tempGLTF.buffers = [];
            for (let index = 0; index < glTFJSON.buffers.length; index++) {
                tempGLTF.buffers.push(await Buffer.loadBuffer(glTFJSON.buffers[index]));
            }
            glTFJSON.images.forEach((currentImage) => {
                tempGLTF.textures.push(currentImage.uri);
            });
            glTFJSON.bufferViews.forEach((currentBufferView) => {
                tempGLTF.bufferViews.push(new BufferView(currentBufferView));
            });
            glTFJSON.accessors.forEach((currentAccessor) => {
                tempGLTF.accessors.push(new Accessor(currentAccessor));
            });
            glTFJSON.meshes.forEach((currentMesh) => {
                tempGLTF.meshes.push(new Mesh(currentMesh));
            });
            glTFJSON.nodes.forEach((currentNode) => {
                if("mesh" in currentNode && !currentNode.name.includes(".")){
                    tempGLTF.uniqueMeshes.set(currentNode.name.split(".")[0], currentNode.mesh);
                }
            });
            glTFJSON.nodes.forEach((currentNode, i: number) => {
                tempGLTF.nodes.push(new Node(glTFJSON.nodes, i, tempGLTF));
            });
            glTFJSON.scenes.forEach((currentScene) => {
                tempGLTF.scenes.push(new Scene(currentScene, tempGLTF.nodes));
            });
            tempGLTF.currentScene = glTFJSON.scene;
            resolve(tempGLTF);
        });
    }
}
//UTILITY-FUNCTIONS START HERE
//Euler rotation
function rotateXYZ(matrix: mat4, rot: vec3): void {
    //@ts-ignore
    mat4.rotateX(matrix, matrix, toRadians(rot[0]));
    //@ts-ignore
    mat4.rotateY(matrix, matrix, toRadians(rot[1]));
    //@ts-ignore
    mat4.rotateZ(matrix, matrix, toRadians(rot[2]));
}
//Load an image from res/assets
async function loadImage(imageName: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve) => {
        var image: HTMLImageElement = new Image();
        image.src = imageName;
        image.onload = () => {
            resolve(image);
        };
    });
}
//Convert degrees to radians(https://en.wikipedia.org/wiki/Radian)
function toRadians(x: number): number {
    return x * (Math.PI / 180);
}
//Convert seconds to milliseconds
function millisToSeconds(s: number): number {
    return s * 0.001;
}
//Retrieve a file
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
//Create a screenfilling canvas and retrieve the WebGL context
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
//MAIN-FUNCTION
async function main(): Promise<void> {
    var gl: WebGL2RenderingContext = await createContext();

    var renderer: MasterRenderer = await MasterRenderer.init(gl);
    var gltf: glTF = await glTF.loadGLTFFile("res/assets/inforaum.gltf");
    var scene: Scene = gltf.scenes[gltf.currentScene];
    await scene.load(gl, renderer.entityRenderer.program, gltf);
    //@ts-ignore
    var camera: Camera = new Camera(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 0));

    //@ts-ignore
    var sun: Light = new DirectionalLight(vec3.fromValues(0, 1, 0));

    var tile: TerrainTile;
    TerrainTile.generateTerrainTile(gl, renderer.terrainRenderer.program, 20, [-30, -0.15, -20], await Texture.loadTexture(gl, "grass.jpg"), 3157).then((terrainTile: TerrainTile) => {
        tile = terrainTile;
    });
    var then: number = millisToSeconds(Date.now());
    var deltaTime: number;
    var isPointerLocked: boolean = false;
    //Resize the canvas
    document.getElementById("webgl_canvas").onresize = () => {
        renderer.updateProjectionMatrix(gl);
    };
    //React to keyboard presses
    window.onkeydown = async (ev: KeyboardEvent) => {
        if (ev.code === "KeyC") {
            camera.pos[1] -= Camera.SPEED * deltaTime;
        } else if (ev.code === "Space") {
            camera.pos[1] += Camera.SPEED * deltaTime;
        }
        let distance: number = Camera.SPEED * deltaTime;
        if (ev.code === "KeyW") {
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1]));
        } else if (ev.code === "KeyS") {
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1]));
        }
        if (ev.code === "KeyA") {
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1] + 90));
        } else if (ev.code === "KeyD") {
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1] + 90));
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
    //React to mousemovements
    window.onmousemove = (ev: MouseEvent) => {
        if (isPointerLocked) {
            camera.rot[1] -= ev.movementX / gl.canvas.width * 180;
        }
    };
    window.requestAnimationFrame(mainLoop);
    //Mainloop
    function mainLoop(): void {
        deltaTime = millisToSeconds(Date.now()) - then;
        then = millisToSeconds(Date.now());
        gl.canvas.width = window.innerWidth;
        gl.canvas.height = window.innerHeight;
        renderer.renderScene(gl, camera, sun, scene, [tile]);
        window.requestAnimationFrame(mainLoop);
    }
    renderer.delete(gl);
    VAO.deleteALL(gl);
    Texture.deleteALL(gl);
    gl.getExtension("WEBGL_lose_context").loseContext();
}
document.body.onload = main;
//ROT1: Foemjdi gfujdi