//@ts-ignore
const { vec2, vec3, vec4, mat2, mat3, mat4, quat } = glMatrix;
class Program {
    shaders;
    program;
    start(gl) {
        gl.useProgram(this.program);
    }
    stop(gl) {
        gl.useProgram(null);
    }
    getUniformLocation(gl, name) {
        return gl.getUniformLocation(this.program, name);
    }
    delete(gl) {
        gl.deleteProgram(this.program);
    }
    static async loadShader(gl, name, shaderType) {
        return new Promise(async (resolve, reject) => {
            var shader = gl.createShader(shaderType);
            gl.shaderSource(shader, `#version 300 es
            ${await loadFile(`res/shaders/${name}`)}`);
            gl.compileShader(shader);
            if (gl.getShaderParameter(shader, WebGL2RenderingContext.COMPILE_STATUS)) {
                resolve(shader);
            }
            else {
                let shaderInfoLog = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                reject(new Error(`${shaderType == WebGL2RenderingContext.VERTEX_SHADER ? "Vertex Shader: " : "Fragment Shader: "}${shaderInfoLog}`));
            }
        });
    }
    static async loadProgram(gl, name) {
        return new Promise(async (resolve, reject) => {
            var program = new Program();
            program.program = gl.createProgram();
            program.shaders = await Promise.all([Program.loadShader(gl, `${name}.vert`, WebGL2RenderingContext.VERTEX_SHADER), Program.loadShader(gl, `${name}.frag`, WebGL2RenderingContext.FRAGMENT_SHADER)]);
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
    static async loadVBOFromArray(gl, vboData, dynamicDraw = false) {
        return new Promise((resolve) => {
            var vbo = new VBO();
            vbo.vbo = gl.createBuffer();
            vbo.vboData = vboData;
            vbo.bindVBO(gl);
            gl.bufferData((vbo.vboData.isIndexBuffer ? WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER : WebGL2RenderingContext.ARRAY_BUFFER), vboData.data, dynamicDraw ? WebGL2RenderingContext.DYNAMIC_DRAW : WebGL2RenderingContext.STATIC_DRAW);
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
    static deleteALL(gl) {
        VAO.vaos.reverse().forEach((currentVAO) => {
            currentVAO.delete(gl);
        });
    }
    static getVAO(vaoID) {
        return VAO.vaos[vaoID];
    }
    static async loadVAOFromOBJFile(gl, program, objName) {
        return new Promise(async (resolve) => {
            var vertices = [];
            var normals = [];
            var textureCords = [];
            var processedVertices = [];
            var processedNormals = [];
            var processedTextureCords = [];
            var objFileContents = await loadFile(`res/assets/${objName}.obj`);
            function processVertex(vertex) {
                let currentVertex = Number.parseInt(vertex[0]) - 1;
                let currentTexCord = Number.parseInt(vertex[1]) - 1;
                let currentNormal = Number.parseInt(vertex[2]) - 1;
                processedVertices.push(vertices[currentVertex][0]);
                processedVertices.push(vertices[currentVertex][1]);
                processedVertices.push(vertices[currentVertex][2]);
                processedNormals.push(normals[currentNormal][0]);
                processedNormals.push(normals[currentNormal][1]);
                processedNormals.push(normals[currentNormal][2]);
                processedTextureCords.push(textureCords[currentTexCord][0]);
                processedTextureCords.push(1 - textureCords[currentTexCord][1]);
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
            objFileContents.split(/\r\n|\r|\n/).forEach((currentLine) => {
                if (currentLine.startsWith("v ")) {
                    var lineSplit = currentLine.split(" ");
                    //@ts-ignore
                    vertices.push(vec3.fromValues(Number.parseFloat(lineSplit[1]), Number.parseFloat(lineSplit[2]), Number.parseFloat(lineSplit[3])));
                }
                else if (currentLine.startsWith("vn ")) {
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
            resolve(await VAO.loadVAOFromArray(gl, false, new VBOData(gl, new Float32Array(processedVertices), program, "POSITION", 3, WebGL2RenderingContext.FLOAT), new VBOData(gl, new Float32Array(processedNormals), program, "NORMAL", 3, WebGL2RenderingContext.FLOAT), new VBOData(gl, new Float32Array(processedTextureCords), program, "TEXCOORD_0", 2, WebGL2RenderingContext.FLOAT)));
        });
    }
    static async loadVAOFromArray(gl, dynamicDraw = false, ...vboData) {
        return new Promise(async (resolve) => {
            var vao = new VAO();
            vao.vao = gl.createVertexArray();
            vao.containsIndexBuffer = false;
            vao.bindVAO(gl);
            vao.vbos = await Promise.all((() => {
                var vboPromises = [];
                vboData.forEach((currentVBOData) => {
                    vboPromises.push(VBO.loadVBOFromArray(gl, currentVBOData, dynamicDraw));
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
    delete(gl) {
        gl.deleteTexture(this.texture);
    }
    static deleteALL(gl) {
        Texture.textures.reverse().forEach((currentTexture) => {
            currentTexture.delete(gl);
        });
    }
    static getTexture(textureID) {
        return Texture.textures[textureID];
    }
    static async loadTexture(gl, textureName) {
        return new Promise(async (resolve) => {
            var texture = new Texture();
            texture.texture = gl.createTexture();
            texture.bindTexture(gl);
            var image = await loadImage(`res/assets/${textureName}`);
            gl.texImage2D(WebGL2RenderingContext.TEXTURE_2D, 0, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.UNSIGNED_BYTE, image);
            gl.generateMipmap(WebGL2RenderingContext.TEXTURE_2D);
            let ext = gl.getExtension("EXT_texture_filter_anisotropic");
            gl.texParameterf(WebGL2RenderingContext.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
            texture.unbindTexture(gl);
            Texture.textures.push(texture);
            resolve(Texture.textures.length - 1);
        });
    }
}
class Model {
    vaoID;
    textureID;
    static models = [];
    static testTexture = -1;
    constructor(vaoID, textureID = -1) {
        this.vaoID = vaoID;
        this.textureID = textureID == -1 ? Model.testTexture : textureID;
    }
    static async initTestTexture(gl) {
        Model.testTexture = await Texture.loadTexture(gl, "uvgrid.jpg");
    }
    static getModel(modelID) {
        return Model.models[modelID];
    }
    static async loadModel(gl, program, name) {
        return new Promise(async (resolve) => {
            if (this.testTexture == -1) {
                await Model.initTestTexture(gl);
            }
            Model.models.push(new Model(await VAO.loadVAOFromOBJFile(gl, program, name), await Texture.loadTexture(gl, `${name}.png`)));
            resolve(Model.models.length - 1);
        });
    }
    static async loadModelWithoutTexture(gl, program, name) {
        return new Promise(async (resolve, reject) => {
            if (this.testTexture == -1) {
                await Model.initTestTexture(gl);
            }
            Model.models.push(new Model(await VAO.loadVAOFromOBJFile(gl, program, name)));
            resolve(Model.models.length - 1);
        });
    }
    static async loadModelWithSeperateResources(gl, program, modelName, textureName) {
        return new Promise(async (resolve) => {
            if (this.testTexture == -1) {
                await Model.initTestTexture(gl);
            }
            Model.models.push(new Model(await VAO.loadVAOFromOBJFile(gl, program, modelName), await Texture.loadTexture(gl, textureName)));
            resolve(Model.models.length - 1);
        });
    }
    static async loadWithCustomVAO(gl, program, vaoID) {
        return new Promise(async (resolve, reject) => {
            if (this.testTexture == -1) {
                await Model.initTestTexture(gl);
            }
            Model.models.push(new Model(vaoID, Model.testTexture));
            resolve(Model.models.length - 1);
        });
    }
    static async loadWithCustomVAOAndTexture(gl, program, vaoID, textureID) {
        return new Promise(async (resolve, reject) => {
            if (this.testTexture == -1) {
                await Model.initTestTexture(gl);
            }
            Model.models.push(new Model(vaoID, textureID));
            resolve(Model.models.length - 1);
        });
    }
}
class Entity {
    modelID;
    pos;
    rot;
    scl;
    disableFarPlaneCulling;
    disableBackFaceCulling;
    static G = 9.81;
    constructor(modelID, pos, rot, scl, disableBackFaceCulling = false, disableFarPlaneCulling = false) {
        this.modelID = modelID;
        this.pos = pos;
        this.rot = rot;
        this.scl = scl;
        //TODO: This is terrible
        this.disableFarPlaneCulling = disableFarPlaneCulling;
        this.disableBackFaceCulling = disableBackFaceCulling;
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
        mat4.fromRotationTranslationScale(transformationMatrix, this.rot, this.pos, this.scl);
        return transformationMatrix;
    }
}
class PerlinNoiseGenerator {
    seed;
    stepSize;
    static AMPLITUDE = 7;
    static OCTAVES = 2;
    static ROUGHNESS = 0.3;
    constructor(seed, stepSize) {
        this.seed = seed;
        this.stepSize = stepSize;
    }
    getInterpolatedNoise(x, z) {
        const intX = Math.floor(x);
        const intZ = Math.floor(z);
        const fracX = x - intX;
        const fracZ = z - intZ;
        const v1 = this.getSmoothNoise(intX, intZ);
        const v2 = this.getSmoothNoise(intX + 1, intZ);
        const v3 = this.getSmoothNoise(intX, intZ + 1);
        const v4 = this.getSmoothNoise(intX + 1, intZ + 1);
        const i1 = this.interpolate(v1, v2, fracX);
        const i2 = this.interpolate(v3, v4, fracX);
        return this.interpolate(i1, i2, fracZ);
    }
    interpolate(a, b, blend) {
        const theta = blend * Math.PI;
        const f = (1 - Math.cos(theta)) * 0.5;
        return a * (1 - f) + b * f;
    }
    getSmoothNoise(x, z) {
        const corners = (this.getNoise(x - 1, z - 1) + this.getNoise(x - 1, z + 1) + this.getNoise(x + 1, z - 1) + this.getNoise(x + 1, z + 1)) / 16;
        const sides = (this.getNoise(x - 1, z) + this.getNoise(x, z + 1) + this.getNoise(x + 1, z) + this.getNoise(x, z - 1)) / 8;
        const middle = this.getNoise(x, z) / 4;
        return corners + sides + middle;
    }
    getHeight(x, z) {
        var total = 0;
        const d = Math.pow(2, PerlinNoiseGenerator.OCTAVES - 1);
        for (let i = 0; i < PerlinNoiseGenerator.OCTAVES; i++) {
            const freq = Math.pow(2, i) / d;
            const amp = Math.pow(PerlinNoiseGenerator.ROUGHNESS, i) * PerlinNoiseGenerator.AMPLITUDE;
            total += this.getInterpolatedNoise(x * freq, z * freq) * amp;
        }
        return total;
    }
    getNoise(x, z) {
        //@ts-ignore
        return (new Math.seedrandom(Math.ceil(x * 123123 + z * 324234 + this.seed)))() * 2 - 1;
    }
}
class TerrainTile {
    vaoID;
    textureID;
    pos;
    static TILE_SIZE = 50;
    createTransformationMatrix() {
        //@ts-ignore
        return mat4.translate(mat4.create(), mat4.create(), this.pos);
    }
    static async generateTerrainTile(gl, program, resolution, pos, textureID, seed) {
        return new Promise(async (resolve) => {
            var terrainTile = new TerrainTile();
            let VERTICES_PER_ROW = resolution + 1;
            let VERTEX_COUNT = Math.pow(VERTICES_PER_ROW, 2);
            let QUADS_PER_ROW = resolution * 2;
            var vertices = new Float32Array(VERTEX_COUNT * 3);
            var normals = new Float32Array(VERTEX_COUNT * 3);
            var texCords = new Float32Array(VERTEX_COUNT * 2);
            var indices = new Uint16Array(QUADS_PER_ROW * resolution * 3);
            let STEP_SIZE = TerrainTile.TILE_SIZE / resolution;
            var perlinNoiseGenerator = new PerlinNoiseGenerator(seed, STEP_SIZE);
            for (let Z = 0; Z < VERTICES_PER_ROW; Z++) {
                for (let X = 0; X < VERTICES_PER_ROW; X++) {
                    let INDEX = Z + X * VERTICES_PER_ROW;
                    vertices[INDEX * 3] = (X * 2 - 1) * STEP_SIZE;
                    vertices[INDEX * 3 + 1] = perlinNoiseGenerator.getHeight((X) * STEP_SIZE, (Z) * STEP_SIZE);
                    vertices[INDEX * 3 + 2] = (Z * 2 - 1) * STEP_SIZE;
                    texCords[INDEX * 2] = Z * STEP_SIZE;
                    texCords[INDEX * 2 + 1] = X * STEP_SIZE;
                }
            }
            for (let X = 0; X < VERTICES_PER_ROW; X++) {
                for (let Z = 0; Z < VERTICES_PER_ROW; Z++) {
                    let INDEX = Z + X * VERTICES_PER_ROW;
                    let heightL;
                    let heightR;
                    let heightD;
                    let heightU;
                    if (X == 0 && Z == 0) {
                        heightL = perlinNoiseGenerator.getHeight((X - 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z + 1) * STEP_SIZE);
                    }
                    else if (X == 0 && Z == resolution) {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = perlinNoiseGenerator.getHeight((X + 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z + 1) * STEP_SIZE);
                    }
                    else if (X == resolution && Z == 0) {
                        heightL = perlinNoiseGenerator.getHeight((X - 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z - 1) * STEP_SIZE);
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    }
                    else if (X == resolution && Z == resolution) {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = perlinNoiseGenerator.getHeight((X + 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightD = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z - 1) * STEP_SIZE);
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    }
                    else if (X == 0) {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z + 1) * STEP_SIZE);
                    }
                    else if (X == resolution) {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = perlinNoiseGenerator.getHeight(X * STEP_SIZE, (Z - 1) * STEP_SIZE);
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    }
                    else if (Z == 0) {
                        heightL = perlinNoiseGenerator.getHeight((X - 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    }
                    else if (Z == resolution) {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = perlinNoiseGenerator.getHeight((X + 1) * STEP_SIZE, Z * STEP_SIZE);
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    }
                    else {
                        heightL = vertices[(INDEX - 1) * 3 + 1];
                        heightR = vertices[(INDEX + 1) * 3 + 1];
                        heightD = vertices[(INDEX + VERTICES_PER_ROW) * 3 + 1];
                        heightU = vertices[(INDEX - VERTICES_PER_ROW) * 3 + 1];
                    }
                    //@ts-ignore
                    const normal = vec3.normalize(vec3.create(), vec3.fromValues(heightU - heightD, 2, heightL - heightR));
                    normals[INDEX * 3] = normal[0];
                    normals[INDEX * 3 + 1] = normal[1];
                    normals[INDEX * 3 + 2] = normal[2];
                }
            }
            for (let Z = 0; Z < resolution; Z++) {
                for (let X = 0; X < resolution; X++) {
                    let INDEX = Z * resolution + X;
                    let UPPER_LEFT_VERTEX = X + Z * VERTICES_PER_ROW;
                    let UPPER_RIGHT_VERTEX = UPPER_LEFT_VERTEX + 1;
                    let LOWER_LEFT_VERTEX = X + VERTICES_PER_ROW * (Z + 1);
                    let LOWER_RIGHT_VERTEX = LOWER_LEFT_VERTEX + 1;
                    indices[INDEX * 6] = UPPER_LEFT_VERTEX;
                    indices[INDEX * 6 + 1] = UPPER_RIGHT_VERTEX;
                    indices[INDEX * 6 + 2] = LOWER_LEFT_VERTEX;
                    indices[INDEX * 6 + 3] = LOWER_LEFT_VERTEX;
                    indices[INDEX * 6 + 4] = UPPER_RIGHT_VERTEX;
                    indices[INDEX * 6 + 5] = LOWER_RIGHT_VERTEX;
                }
            }
            terrainTile.vaoID = await VAO.loadVAOFromArray(gl, true, new VBOData(gl, vertices, program, "in_pos", 3, WebGL2RenderingContext.FLOAT), new VBOData(gl, normals, program, "in_normal", 3, WebGL2RenderingContext.FLOAT), new VBOData(gl, texCords, program, "in_texCord", 2, WebGL2RenderingContext.FLOAT), new VBOData(gl, indices, program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true));
            terrainTile.textureID = textureID;
            terrainTile.pos = pos;
            resolve(terrainTile);
        });
    }
}
class DirectionalLight {
    dir;
    constructor(dir) {
        //@ts-ignore
        this.dir = vec3.normalize(vec3.create(), dir);
    }
}
class PointLight {
    pos;
    constructor(pos) {
        this.pos = pos;
    }
}
class Camera {
    rot;
    pos;
    viewMatrix;
    static SPEED = 20;
    constructor(pos, rot) {
        this.rot = rot;
        this.pos = pos;
    }
    updateViewMatrix() {
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
class EntityRenderer {
    program;
    lightCountLocation;
    lightPositionsLocation;
    viewWorldPositionLocation;
    worldMatrixLocation;
    projectionViewTransformationMatrixLocation;
    transformationInverseTransposeMatrixLocation;
    reverseLightDirectionLocation;
    textureLocation;
    entityMap;
    lightDataArray;
    static async init(gl, programName) {
        return new Promise(async (resolve) => {
            var entityRenderer = new EntityRenderer();
            entityRenderer.program = await Program.loadProgram(gl, programName);
            entityRenderer.lightCountLocation = entityRenderer.program.getUniformLocation(gl, "u_lightCount");
            entityRenderer.lightPositionsLocation = entityRenderer.program.getUniformLocation(gl, "u_lightPositions");
            entityRenderer.viewWorldPositionLocation = entityRenderer.program.getUniformLocation(gl, "u_viewWorldPosition");
            entityRenderer.worldMatrixLocation = entityRenderer.program.getUniformLocation(gl, "u_world");
            entityRenderer.projectionViewTransformationMatrixLocation = entityRenderer.program.getUniformLocation(gl, "u_projectionViewTransformationMatrix");
            entityRenderer.transformationInverseTransposeMatrixLocation = entityRenderer.program.getUniformLocation(gl, "u_transformInverseTransposeMatrix");
            entityRenderer.reverseLightDirectionLocation = entityRenderer.program.getUniformLocation(gl, "u_reverseLightDirection");
            entityRenderer.textureLocation = entityRenderer.program.getUniformLocation(gl, "u_texture");
            resolve(entityRenderer);
        });
    }
    delete(gl) {
        this.program.delete(gl);
    }
    prepareEntities(entities) {
        this.entityMap = new Map();
        entities.forEach((currentEntity) => {
            if (!this.entityMap.has(currentEntity.modelID)) {
                this.entityMap.set(currentEntity.modelID, []);
            }
            this.entityMap.get(currentEntity.modelID).push(currentEntity);
        });
    }
    prepareLights(lights) {
        this.lightDataArray = new Float32Array(8 * 3);
        for (let index = 0; index < 8; index++) {
            if (index >= lights.length) {
                this.lightDataArray[index * 3] = 0;
                this.lightDataArray[index * 3 + 1] = 0;
                this.lightDataArray[index * 3 + 2] = 0;
            }
            else {
                this.lightDataArray[index * 3] = lights[index].pos[0];
                this.lightDataArray[index * 3 + 1] = lights[index].pos[1];
                this.lightDataArray[index * 3 + 2] = lights[index].pos[2];
            }
        }
    }
    prepare(gl, scene) {
        this.prepareEntities(scene.entities);
        this.prepareLights(scene.lights);
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        gl.enable(WebGL2RenderingContext.CULL_FACE);
        gl.cullFace(WebGL2RenderingContext.BACK);
        this.program.start(gl);
    }
    finish(gl) {
        this.program.stop(gl);
    }
    loadDataToUniforms(gl, projectionViewMatrix, sun, currentEntity, lightCount, cameraPos) {
        var currentTransformationMatrix = currentEntity.createTransformationMatrix();
        //@ts-ignore
        var projectionViewTransformationMatrix = mat4.mul(mat4.create(), projectionViewMatrix, currentTransformationMatrix);
        //@ts-ignore
        var transformationInverseMatrix = mat4.invert(mat4.create(), currentTransformationMatrix);
        gl.uniform1i(this.lightCountLocation, lightCount);
        gl.uniform3fv(this.lightPositionsLocation, this.lightDataArray);
        gl.uniform3fv(this.viewWorldPositionLocation, cameraPos);
        gl.uniformMatrix4fv(this.worldMatrixLocation, false, currentTransformationMatrix);
        gl.uniformMatrix4fv(this.projectionViewTransformationMatrixLocation, false, projectionViewTransformationMatrix);
        gl.uniformMatrix4fv(this.transformationInverseTransposeMatrixLocation, true, transformationInverseMatrix);
        gl.uniform3fv(this.reverseLightDirectionLocation, sun.dir);
    }
    render(gl, cameraPos, projectionViewMatrix, drawMode, sun, scene) {
        this.prepare(gl, scene);
        this.entityMap.forEach((currentEntities, currentModelID) => {
            VAO.getVAO(Model.getModel(currentModelID).vaoID).enableVAO(gl);
            Texture.getTexture(Model.getModel(currentModelID).textureID).activateTexture(gl);
            currentEntities.forEach((currentEntity) => {
                if (currentEntity.disableBackFaceCulling) {
                    gl.disable(WebGL2RenderingContext.CULL_FACE);
                }
                //@ts-ignore
                if (currentEntity.disableFarPlaneCulling || vec3.distance(cameraPos, currentEntity.pos) > EntityRenderer.FAR_PLANE) {
                    return;
                }
                this.loadDataToUniforms(gl, projectionViewMatrix, sun, currentEntity, scene.lights.length, cameraPos);
                if (VAO.vaos[Model.getModel(currentModelID).vaoID].containsIndexBuffer) {
                    gl.drawElements(drawMode, VAO.vaos[Model.getModel(currentModelID).vaoID].length, gl.UNSIGNED_SHORT, 0);
                }
                else {
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
    program;
    projectionViewTransformationMatrixLocation;
    transformationInverseTransposeMatrixLocation;
    reverseLightDirectionLocation;
    textureLocation;
    static async init(gl, programName) {
        return new Promise(async (resolve) => {
            var terrainRenderer = new TerrainRenderer();
            terrainRenderer.program = await Program.loadProgram(gl, programName);
            terrainRenderer.projectionViewTransformationMatrixLocation = terrainRenderer.program.getUniformLocation(gl, "u_projectionViewTransformationMatrix");
            terrainRenderer.transformationInverseTransposeMatrixLocation = terrainRenderer.program.getUniformLocation(gl, "u_transformInverseTransposeMatrix");
            terrainRenderer.reverseLightDirectionLocation = terrainRenderer.program.getUniformLocation(gl, "u_reverseLightDirection");
            terrainRenderer.textureLocation = terrainRenderer.program.getUniformLocation(gl, "u_texture");
            resolve(terrainRenderer);
        });
    }
    delete(gl) {
        this.program.delete(gl);
    }
    prepare(gl) {
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.enable(WebGL2RenderingContext.CULL_FACE);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        gl.cullFace(WebGL2RenderingContext.BACK);
        this.program.start(gl);
    }
    finish(gl) {
        this.program.stop(gl);
    }
    loadDataToUniforms(gl, projectionViewMatrix, sun, currentTile) {
        var currentTransformationMatrix = currentTile.createTransformationMatrix();
        //@ts-ignore
        var projectionViewTransformationMatrix = mat4.mul(mat4.create(), projectionViewMatrix, currentTransformationMatrix);
        //@ts-ignore
        var transformationInverseMatrix = mat4.invert(mat4.create(), currentTransformationMatrix);
        gl.uniformMatrix4fv(this.projectionViewTransformationMatrixLocation, false, projectionViewTransformationMatrix);
        gl.uniformMatrix4fv(this.transformationInverseTransposeMatrixLocation, true, transformationInverseMatrix);
        gl.uniform3fv(this.reverseLightDirectionLocation, sun.dir);
    }
    render(gl, projectionViewMatrix, drawMode, sun, terrainTiles) {
        this.prepare(gl);
        terrainTiles.forEach((currentTile) => {
            if (currentTile == undefined) {
                return;
            }
            VAO.getVAO(currentTile.vaoID).enableVAO(gl);
            Texture.getTexture(currentTile.textureID).activateTexture(gl);
            this.loadDataToUniforms(gl, projectionViewMatrix, sun, currentTile);
            gl.drawElements(drawMode, VAO.getVAO(currentTile.vaoID).length, WebGL2RenderingContext.UNSIGNED_SHORT, 0);
            Texture.getTexture(currentTile.textureID).disableTexture(gl);
            VAO.getVAO(currentTile.vaoID).disableVAO(gl);
        });
        this.finish(gl);
    }
}
class MasterRenderer {
    entityRenderer;
    terrainRenderer;
    projectionMatrix;
    drawMode;
    static FOV = 60;
    static NEAR_PLANE = 0.1;
    static FAR_PLANE = 100;
    static async init(gl) {
        return new Promise(async (resolve) => {
            var masterRenderer = new MasterRenderer();
            masterRenderer.entityRenderer = await EntityRenderer.init(gl, "entityShader");
            masterRenderer.terrainRenderer = await TerrainRenderer.init(gl, "terrainShader");
            //@ts-ignore
            masterRenderer.projectionMatrix = mat4.create();
            masterRenderer.updateProjectionMatrix(gl);
            masterRenderer.drawMode = WebGL2RenderingContext.TRIANGLES;
            resolve(masterRenderer);
        });
    }
    static prepareViewport(gl) {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
    static clear(gl) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(WebGL2RenderingContext.COLOR_BUFFER_BIT);
    }
    updateProjectionMatrix(gl) {
        //@ts-ignore
        mat4.perspective(this.projectionMatrix, toRadians(MasterRenderer.FOV), gl.canvas.width / gl.canvas.height, MasterRenderer.NEAR_PLANE, MasterRenderer.FAR_PLANE);
    }
    renderScene(gl, camera, sun, scene, terrainTiles) {
        MasterRenderer.prepareViewport(gl);
        MasterRenderer.clear(gl);
        camera.updateViewMatrix();
        //@ts-ignore
        var projectionViewMatrix = mat4.mul(mat4.create(), this.projectionMatrix, camera.viewMatrix);
        this.terrainRenderer.render(gl, projectionViewMatrix, this.drawMode, sun, terrainTiles);
        this.entityRenderer.render(gl, camera.pos, projectionViewMatrix, this.drawMode, sun, scene);
    }
}
class Buffer {
    byteLength;
    arrayBuffer;
    constructor(byteLength, arrayBuffer) {
        this.byteLength = byteLength;
        this.arrayBuffer = arrayBuffer;
    }
    static async loadBuffer(bufferInfo) {
        return new Promise(async (resolve, reject) => {
            resolve(new Buffer(bufferInfo.byteLength, await (await fetch(`res/assets/${bufferInfo.uri}`)).arrayBuffer()));
        });
    }
    getDataFromAccessor(accessor, gltf) {
        return accessor.componentType == 5126 ? new Float32Array(this.arrayBuffer, gltf.bufferViews[accessor.bufferView].byteOffset, gltf.bufferViews[accessor.bufferView].byteLength / 4) : new Uint16Array(this.arrayBuffer, gltf.bufferViews[accessor.bufferView].byteOffset, gltf.bufferViews[accessor.bufferView].byteLength / 2);
    }
}
class BufferView {
    buffer;
    byteLength;
    byteOffset;
    constructor(bufferViewInfo) {
        this.buffer = bufferViewInfo.buffer;
        this.byteLength = bufferViewInfo.byteLength;
        this.byteOffset = bufferViewInfo.byteOffset;
    }
}
class Accessor {
    bufferView;
    componentType;
    count;
    type;
    constructor(accessorInfo) {
        this.bufferView = accessorInfo.bufferView;
        this.componentType = accessorInfo.componentType;
        this.count = accessorInfo.count;
        this.type = accessorInfo.type;
    }
}
class Primitive {
    attributes;
    indexAccessor;
    material;
    constructor(primitiveInfo) {
        this.attributes = [];
        for (const key in primitiveInfo.attributes) {
            this.attributes.push(primitiveInfo.attributes[key]);
        }
        this.indexAccessor = primitiveInfo.indices;
        this.material = primitiveInfo.material;
    }
}
class Mesh {
    name;
    primitive;
    vaoID;
    textureID;
    constructor(meshInfo) {
        this.name = meshInfo.name;
        this.primitive = new Primitive(meshInfo.primitives[0]);
        this.vaoID = -1;
        this.textureID = -1;
    }
    async load(gl, program, gltf) {
        if (this.vaoID == -1) {
            let positionAccessor = gltf.accessors[this.primitive.attributes[0]];
            let normalAccessor = gltf.accessors[this.primitive.attributes[1]];
            let texCoordAccessor = gltf.accessors[this.primitive.attributes[2]];
            let indexAccessor = gltf.accessors[this.primitive.indexAccessor];
            let positionBufferView = gltf.bufferViews[positionAccessor.bufferView];
            let normalBufferView = gltf.bufferViews[normalAccessor.bufferView];
            let texCoordBufferView = gltf.bufferViews[texCoordAccessor.bufferView];
            let indexBufferView = gltf.bufferViews[indexAccessor.bufferView];
            this.vaoID = await VAO.loadVAOFromArray(gl, false, new VBOData(gl, gltf.buffers[positionBufferView.buffer].getDataFromAccessor(positionAccessor, gltf), program, "POSITION", 3, positionAccessor.componentType), new VBOData(gl, gltf.buffers[normalBufferView.buffer].getDataFromAccessor(normalAccessor, gltf), program, "NORMAL", 3, positionAccessor.componentType), new VBOData(gl, gltf.buffers[texCoordBufferView.buffer].getDataFromAccessor(texCoordAccessor, gltf), program, "TEXCOORD_0", 2, positionAccessor.componentType), new VBOData(gl, gltf.buffers[indexBufferView.buffer].getDataFromAccessor(indexAccessor, gltf), program, "", 1, positionAccessor.componentType, true));
            this.textureID = await Texture.loadTexture(gl, gltf.textures[this.primitive.material]);
        }
        else {
            console.warn("Mesh already loaded!");
        }
    }
    unload(gl) {
        if (this.vaoID == -1) {
            throw new Error("Can't unload mesh when it's not loaded!");
        }
        VAO.getVAO(this.vaoID).delete(gl);
        this.vaoID = -1;
    }
}
class Node {
    mesh;
    camera;
    name;
    type;
    rotation;
    scale;
    translation;
    constructor(nodeInfos, currentNodeInfo) {
        this.name = nodeInfos[currentNodeInfo].name;
        this.mesh = "mesh" in nodeInfos[currentNodeInfo] ? nodeInfos[currentNodeInfo].mesh : -1;
        if (this.name.startsWith("Light") || this.name.startsWith("Point")) {
            this.type = 1;
        }
        else if ("camera" in nodeInfos) {
            this.type = 3;
            this.camera = nodeInfos.camera;
        }
        else if (this.name.startsWith("Camera")) {
            this.type = 2;
        }
        else {
            this.type = 0;
        }
        //@ts-ignore
        this.rotation = nodeInfos[currentNodeInfo].rotation ? quat.fromValues(nodeInfos[currentNodeInfo].rotation[0], nodeInfos[currentNodeInfo].rotation[1], nodeInfos[currentNodeInfo].rotation[2], nodeInfos[currentNodeInfo].rotation[3]) : quat.fromEuler(quat.create(), 0, 0, 0);
        //@ts-ignore
        this.scale = nodeInfos[currentNodeInfo].scale ? vec3.fromValues(nodeInfos[currentNodeInfo].scale[0], nodeInfos[currentNodeInfo].scale[1], nodeInfos[currentNodeInfo].scale[2]) : vec3.fromValues(1, 1, 1);
        //@ts-ignore
        this.translation = nodeInfos[currentNodeInfo].translation ? vec3.fromValues(nodeInfos[currentNodeInfo].translation[0], nodeInfos[currentNodeInfo].translation[1], nodeInfos[currentNodeInfo].translation[2]) : vec3.fromValues(0, 0, 0);
    }
}
class Scene {
    name;
    entityNodes;
    lightNodes;
    cameraNodes;
    entities;
    lights;
    cameras;
    currentCamera;
    constructor(sceneInfo, nodes) {
        this.name = sceneInfo.name;
        this.entityNodes = [];
        this.lightNodes = [];
        this.cameraNodes = [];
        this.entities = [];
        this.lights = [];
        this.cameras = [];
        sceneInfo.nodes.forEach((currentNode) => {
            if (nodes[currentNode].type == 0) {
                this.entityNodes.push(nodes[currentNode]);
            }
            else if (nodes[currentNode].type == 1) {
                this.lightNodes.push(nodes[currentNode]);
            }
            else if (nodes[currentNode].type == 2) {
                this.cameraNodes.push(nodes[currentNode]);
            }
        });
        this.currentCamera = 0;
    }
    switchCamera(camera) {
        this.currentCamera = camera;
    }
    async load(gl, program, gltf) {
        console.log(this.entityNodes);
        for (let currentEntityNode in this.entityNodes) {
            //@ts-ignore
            if (gltf.meshes[this.entityNodes[currentEntityNode].mesh].vaoID == -1) {
                //@ts-ignore
                await gltf.meshes[this.entityNodes[currentEntityNode].mesh].load(gl, program, gltf);
            }
            //@ts-ignore
            this.entities.push(new Entity(await Model.loadWithCustomVAOAndTexture(gl, program, gltf.meshes[this.entityNodes[currentEntityNode].mesh].vaoID, gltf.meshes[this.entityNodes[currentEntityNode].mesh].textureID), this.entityNodes[currentEntityNode].translation, this.entityNodes[currentEntityNode].rotation, this.entityNodes[currentEntityNode].scale, true));
        }
        this.lightNodes.forEach((currentLightNode) => {
            this.lights.push(new PointLight(currentLightNode.translation));
        });
    }
}
class glTF {
    buffers;
    textures;
    bufferViews;
    accessors;
    meshes;
    nodes;
    scenes;
    currentScene;
    constructor() {
        this.buffers = [];
        this.textures = [];
        this.bufferViews = [];
        this.accessors = [];
        this.meshes = [];
        this.nodes = [];
        this.scenes = [];
    }
    static async loadGLTFFile(gl, uri) {
        return new Promise(async (resolve, reject) => {
            let glTFJSON = await (await fetch(uri)).json();
            let tempGLTF = new glTF();
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
            glTFJSON.nodes.forEach((currentNode, i) => {
                tempGLTF.nodes.push(new Node(glTFJSON.nodes, i));
            });
            glTFJSON.scenes.forEach((currentScene) => {
                tempGLTF.scenes.push(new Scene(currentScene, tempGLTF.nodes));
            });
            tempGLTF.currentScene = glTFJSON.scene;
            resolve(tempGLTF);
        });
    }
}
function rotateXYZ(matrix, rot) {
    //@ts-ignore
    mat4.rotateX(matrix, matrix, toRadians(rot[0]));
    //@ts-ignore
    mat4.rotateY(matrix, matrix, toRadians(rot[1]));
    //@ts-ignore
    mat4.rotateZ(matrix, matrix, toRadians(rot[2]));
}
async function loadImage(imageName) {
    return new Promise((resolve) => {
        var image = new Image();
        image.src = imageName;
        image.onload = () => {
            resolve(image);
        };
    });
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
async function updateEntities(entities, deltaTime) {
    entities.forEach((currentEntity) => {
        currentEntity.update(deltaTime);
    });
}
async function main() {
    var gl = await createContext();
    var renderer = await MasterRenderer.init(gl);
    var gltf = await glTF.loadGLTFFile(gl, "res/assets/inforaum.gltf");
    var scene = gltf.scenes[gltf.currentScene];
    await scene.load(gl, renderer.entityRenderer.program, gltf);
    //@ts-ignore
    var camera = new Camera(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 0));
    //@ts-ignore
    var sun = new DirectionalLight(vec3.fromValues(0, 1, 0));
    var tile;
    TerrainTile.generateTerrainTile(gl, renderer.terrainRenderer.program, 1, [0, 0, 0], await Texture.loadTexture(gl, "grass.jpg"), 3157).then((terrainTile) => {
        tile = terrainTile;
    });
    var then = millisToSeconds(Date.now());
    var deltaTime;
    var isPointerLocked = false;
    document.getElementById("webgl_canvas").onresize = () => {
        renderer.updateProjectionMatrix(gl);
    };
    window.onkeydown = async (ev) => {
        if (ev.code === "KeyC") {
            camera.pos[1] -= Camera.SPEED * deltaTime;
        }
        else if (ev.code === "Space") {
            camera.pos[1] += Camera.SPEED * deltaTime;
        }
        let distance = Camera.SPEED * deltaTime;
        if (ev.code === "KeyW") {
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1]));
        }
        else if (ev.code === "KeyS") {
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1]));
        }
        if (ev.code === "KeyA") {
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1] + 90));
        }
        else if (ev.code === "KeyD") {
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
        if (ev.code === "KeyM") {
            renderer.drawMode = (renderer.drawMode === WebGL2RenderingContext.TRIANGLES) ? WebGL2RenderingContext.LINE_LOOP : WebGL2RenderingContext.TRIANGLES;
        }
    };
    document.onpointerlockchange = () => {
        isPointerLocked = !isPointerLocked;
    };
    window.onmousemove = (ev) => {
        if (isPointerLocked) {
            camera.rot[1] -= ev.movementX / gl.canvas.width * 180;
        }
    };
    window.requestAnimationFrame(mainLoop);
    function mainLoop() {
        deltaTime = millisToSeconds(Date.now()) - then;
        then = millisToSeconds(Date.now());
        gl.canvas.width = window.innerWidth;
        gl.canvas.height = window.innerHeight;
        renderer.renderScene(gl, camera, sun, scene, []);
        //renderer.render(gl, camera, sun, entities, [tile]);
        window.requestAnimationFrame(mainLoop);
    }
}
document.body.onload = main;
export {};
