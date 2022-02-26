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
        }
        else if (data.length === 2) {
            gl.uniform2fv(location, data);
        }
        else if (data.length === 3) {
            gl.uniform3fv(location, data);
        }
        else if (data.length === 4) {
            gl.uniform4fv(location, data);
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
        return name.endsWith(".vert") ? WebGL2RenderingContext.VERTEX_SHADER : WebGL2RenderingContext.FRAGMENT_SHADER;
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
            var indices = [];
            var vertexArray;
            var normalArray;
            var textureCordArray;
            var objFileContents = await loadFile(`res/assets/${objName}.obj`);
            function processVertex(vertex) {
                let currentVertexPointer = Number.parseInt(vertex[0]) - 1;
                indices.push(currentVertexPointer);
                let currentTexCord = textureCords[Number.parseInt(vertex[1]) - 1];
                textureCordArray[currentVertexPointer * 2] = currentTexCord[0];
                textureCordArray[currentVertexPointer * 2 + 1] = 1 - currentTexCord[1];
                let currentNormal = normals[Number.parseInt(vertex[2]) - 1];
                normalArray[currentVertexPointer * 3] = currentNormal[0];
                normalArray[currentVertexPointer * 3 + 1] = currentNormal[1];
                normalArray[currentVertexPointer * 3 + 2] = currentNormal[2];
            }
            objFileContents.split(/\r\n|\r|\n/).forEach((currentLine) => {
                if (currentLine.startsWith("v ")) {
                    var lineSplit = currentLine.split(" ");
                    //@ts-ignore
                    vertices.push(vec3.fromValues(Number.parseFloat(lineSplit[1]), Number.parseFloat(lineSplit[2]), Number.parseFloat(lineSplit[3])));
                }
                else if (currentLine.startsWith("vn ")) {
                    if (vertexArray == undefined) {
                        vertexArray = new Float32Array(vertices.length * 3);
                        normalArray = new Float32Array(vertices.length * 3);
                        textureCordArray = new Float32Array(vertices.length * 2);
                    }
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
            vertices.forEach((currentVertex, i) => {
                vertexArray[i * 3] = currentVertex[0];
                vertexArray[i * 3 + 1] = currentVertex[1];
                vertexArray[i * 3 + 2] = currentVertex[2];
            });
            resolve(await VAO.loadVAOFromArray(gl, false, new VBOData(gl, vertexArray, program, "in_pos", 3, WebGL2RenderingContext.FLOAT), new VBOData(gl, normalArray, program, "in_normal", 3, WebGL2RenderingContext.FLOAT), new VBOData(gl, textureCordArray, program, "in_texCord", 2, WebGL2RenderingContext.FLOAT), new VBOData(gl, new Uint16Array(indices), program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true)));
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
    static getModel(modelID) {
        return Model.models[modelID];
    }
    static async loadModel(gl, program, name) {
        return new Promise(async (resolve) => {
            var model = new Model();
            model.vaoID = await VAO.loadVAOFromOBJFile(gl, program, name);
            model.textureID = await Texture.loadTexture(gl, `${name}.png`);
            Model.models.push(model);
            resolve(Model.models.length - 1);
        });
    }
    static async loadModelWithSeperateResources(gl, program, modelName, textureName) {
        return new Promise(async (resolve) => {
            var model = new Model();
            model.vaoID = await VAO.loadVAOFromOBJFile(gl, program, modelName);
            model.textureID = await Texture.loadTexture(gl, textureName);
            Model.models.push(model);
            resolve(Model.models.length - 1);
        });
    }
}
class Entity {
    modelID;
    pos;
    rot;
    disableFarPlaneCulling;
    disableBackFaceCulling;
    static G = 9.81;
    constructor(modelID, pos, rot, disableBackFaceCulling = false, disableFarPlaneCulling = false) {
        this.modelID = modelID;
        this.pos = pos;
        this.rot = rot;
        //TODO: This is terrible
        this.disableFarPlaneCulling = disableFarPlaneCulling;
        this.disableBackFaceCulling = disableBackFaceCulling;
    }
    update(deltaTime) {
        if (this.pos[1] <= 0) {
            this.pos[1] += Entity.G * deltaTime;
        }
        this.rot[0] += 20 * deltaTime;
        this.rot[1] += 20 * deltaTime;
        this.rot[2] += 20 * deltaTime;
    }
    createTransformationMatrix() {
        //@ts-ignore
        var transformationMatrix = mat4.create();
        //@ts-ignore
        mat4.translate(transformationMatrix, transformationMatrix, vec3.negate(vec3.create(), this.pos));
        rotateXYZ(transformationMatrix, this.rot);
        return transformationMatrix;
    }
}
class TerrainTile {
    vaoID;
    textureID;
    pos;
    static TILE_SIZE = 5;
    static AMPLITUDE = 2;
    createTransformationMatrix() {
        //@ts-ignore
        return mat4.translate(mat4.create(), mat4.create(), vec3.negate(vec3.create(), this.pos));
    }
    static getInterpolatedNoise(seed, x, z) {
        let fracX = x % 1;
        let fracZ = z % 1;
        let v1 = TerrainTile.getSmoothNoise(seed, fracX, fracZ);
        let v2 = TerrainTile.getSmoothNoise(seed, fracX + 1, fracZ);
        let v3 = TerrainTile.getSmoothNoise(seed, fracX, fracZ + 1);
        let v4 = TerrainTile.getSmoothNoise(seed, fracX + 1, fracZ + 1);
        let i1 = TerrainTile.interpolate(v1, v2, fracX);
        let i2 = TerrainTile.interpolate(v3, v4, fracX);
        return TerrainTile.interpolate(i1, i2, fracZ);
    }
    static interpolate(a, b, blend) {
        let f = (1 - Math.cos(blend * Math.PI)) * 0.5;
        return a * (1 - f) + b * f;
    }
    static getSmoothNoise(seed, x, z) {
        let corners = (TerrainTile.getNoise(seed, x - 1, z - 1) + TerrainTile.getNoise(seed, x - 1, z + 1) + TerrainTile.getNoise(seed, x + 1, z - 1) + TerrainTile.getNoise(seed, x + 1, z + 1)) / 16;
        let sides = (TerrainTile.getNoise(seed, x - 1, z) + TerrainTile.getNoise(seed, x, z + 1) + TerrainTile.getNoise(seed, x + 1, z) + TerrainTile.getNoise(seed, x, z - 1)) / 8;
        let middle = TerrainTile.getNoise(seed, x, z) / 4;
        return corners + sides + middle;
    }
    static getHeight(seed, x, z) {
        return TerrainTile.getInterpolatedNoise(seed, x, z) * TerrainTile.AMPLITUDE;
    }
    static getNoise(seed, x, z) {
        //@ts-ignore
        return (new Math.seedrandom(Math.ceil(x * 10000 + z * 100000 * seed)))() * 2 - 1;
    }
    static async generateTerrainTile(gl, program, resolution, textureID, seed) {
        return new Promise(async (resolve) => {
            var terrainTile = new TerrainTile();
            let VERTICES_PER_ROW = resolution + 1;
            let VERTEX_COUNT = Math.pow(VERTICES_PER_ROW, 2);
            let QUADS_PER_ROW = resolution * 2;
            var vertices = new Float32Array(VERTEX_COUNT * 3);
            var normals = new Float32Array(VERTEX_COUNT * 3);
            var textureCords = new Float32Array(VERTEX_COUNT * 2);
            var indices = new Uint16Array(QUADS_PER_ROW * resolution * 3);
            let STEP_SIZE = TerrainTile.TILE_SIZE / resolution;
            for (let X = 0; X < VERTICES_PER_ROW; X++) {
                for (let Z = 0; Z < VERTICES_PER_ROW; Z++) {
                    let INDEX = Z + X * VERTICES_PER_ROW;
                    vertices[INDEX * 3] = (X * 2 - 1) * STEP_SIZE;
                    vertices[INDEX * 3 + 2] = (Z * 2 - 1) * STEP_SIZE;
                    vertices[INDEX * 3 + 1] = TerrainTile.getHeight(seed, X * STEP_SIZE, Z * STEP_SIZE);
                    normals[INDEX * 3] = 0;
                    normals[INDEX * 3 + 1] = 1;
                    normals[INDEX * 3 + 2] = 0;
                    textureCords[INDEX * 2] = Z * STEP_SIZE;
                    textureCords[INDEX * 2 + 1] = X * STEP_SIZE;
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
            terrainTile.vaoID = await VAO.loadVAOFromArray(gl, true, new VBOData(gl, vertices, program, "in_pos", 3, WebGL2RenderingContext.FLOAT), new VBOData(gl, textureCords, program, "in_texCord", 2, WebGL2RenderingContext.FLOAT), new VBOData(gl, indices, program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true));
            terrainTile.textureID = textureID;
            terrainTile.pos = [0, 0, 0];
            console.log(textureCords);
            resolve(terrainTile);
        });
    }
}
class Light {
    dir;
    constructor(dir) {
        //@ts-ignore
        this.dir = vec3.create();
        //@ts-ignore
        vec3.normalize(this.dir, dir);
    }
}
class Camera {
    rot;
    pos;
    viewMatrix;
    static SPEED = 5;
    constructor(pos, rot) {
        this.rot = rot;
        this.pos = pos;
    }
    updateViewMatrix() {
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
    program;
    projectionViewTransformationMatrixLocation;
    transformationInverseTransposeMatrixLocation;
    reverseLightDirectionLocation;
    textureLocation;
    entityMap;
    static async init(gl, programName) {
        return new Promise(async (resolve) => {
            var renderer = new EntityRenderer();
            renderer.program = await Program.loadProgram(gl, programName);
            renderer.projectionViewTransformationMatrixLocation = renderer.program.getUniformLocation(gl, "u_projectionViewTransformationMatrix");
            renderer.transformationInverseTransposeMatrixLocation = renderer.program.getUniformLocation(gl, "u_transformInverseTransposeMatrix");
            renderer.reverseLightDirectionLocation = renderer.program.getUniformLocation(gl, "u_reverseLightDirection");
            renderer.textureLocation = renderer.program.getUniformLocation(gl, "u_texture");
            resolve(renderer);
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
    render(gl, cameraPos, projectionViewMatrix, drawMode, light, entities) {
        this.prepareEntities(entities);
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        gl.enable(WebGL2RenderingContext.CULL_FACE);
        gl.cullFace(WebGL2RenderingContext.BACK);
        this.program.start(gl);
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
                //@ts-ignore
                var currentTransformationMatrix = currentEntity.createTransformationMatrix();
                //@ts-ignore
                this.program.loadDataToUniform(gl, this.projectionViewTransformationMatrixLocation, mat4.mul(mat4.create(), projectionViewMatrix, currentTransformationMatrix));
                //@ts-ignore
                mat4.invert(currentTransformationMatrix, currentTransformationMatrix);
                //@ts-ignore
                mat4.transpose(currentTransformationMatrix, currentTransformationMatrix);
                this.program.loadDataToUniform(gl, this.transformationInverseTransposeMatrixLocation, currentTransformationMatrix);
                this.program.loadDataToUniform(gl, this.reverseLightDirectionLocation, light.dir);
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
        this.program.stop(gl);
    }
}
class TerrainRenderer {
    program;
    projectionViewTransformationMatrixLocation;
    textureLocation;
    static async init(gl, programName) {
        return new Promise(async (resolve) => {
            var terrainRenderer = new TerrainRenderer();
            terrainRenderer.program = await Program.loadProgram(gl, programName);
            terrainRenderer.projectionViewTransformationMatrixLocation = terrainRenderer.program.getUniformLocation(gl, "u_projectionViewTransformationMatrix");
            terrainRenderer.textureLocation = terrainRenderer.program.getUniformLocation(gl, "u_texture");
            resolve(terrainRenderer);
        });
    }
    delete(gl) {
        this.program.delete(gl);
    }
    render(gl, projectionViewMatrix, drawMode, terrainTiles) {
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.disable(WebGL2RenderingContext.CULL_FACE);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        this.program.start(gl);
        terrainTiles.forEach((currentTerrainTile) => {
            VAO.getVAO(currentTerrainTile.vaoID).enableVAO(gl);
            Texture.getTexture(currentTerrainTile.textureID).activateTexture(gl);
            //@ts-ignore
            this.program.loadDataToUniform(gl, this.projectionViewTransformationMatrixLocation, mat4.mul(mat4.create(), projectionViewMatrix, currentTerrainTile.createTransformationMatrix()));
            gl.drawElements(drawMode, VAO.getVAO(currentTerrainTile.vaoID).length, WebGL2RenderingContext.UNSIGNED_SHORT, 0);
            Texture.getTexture(currentTerrainTile.textureID).disableTexture(gl);
            VAO.getVAO(currentTerrainTile.vaoID).disableVAO(gl);
        });
        this.program.stop(gl);
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
        gl.clearColor(0, 0, 0, 0);
        gl.clear(WebGL2RenderingContext.COLOR_BUFFER_BIT);
    }
    updateProjectionMatrix(gl) {
        //@ts-ignore
        mat4.perspective(this.projectionMatrix, toRadians(MasterRenderer.FOV), gl.canvas.width / gl.canvas.height, MasterRenderer.NEAR_PLANE, MasterRenderer.FAR_PLANE);
    }
    render(gl, camera, light, entities, terrainTiles) {
        MasterRenderer.prepareViewport(gl);
        MasterRenderer.clear(gl);
        camera.updateViewMatrix();
        //@ts-ignore
        var projectionViewMatrix = mat4.mul(mat4.create(), this.projectionMatrix, camera.viewMatrix);
        this.terrainRenderer.render(gl, projectionViewMatrix, this.drawMode, terrainTiles);
        this.entityRenderer.render(gl, camera.pos, projectionViewMatrix, this.drawMode, light, entities);
    }
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
function rotateXYZ(matrix, rot) {
    //@ts-ignore
    mat4.rotateX(matrix, matrix, toRadians(rot[0]));
    //@ts-ignore
    mat4.rotateY(matrix, matrix, toRadians(rot[1]));
    //@ts-ignore
    mat4.rotateZ(matrix, matrix, toRadians(rot[2]));
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
        canvas.style.background = "black";
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
async function init() {
    var gl = await createContext();
    var renderer = await MasterRenderer.init(gl);
    //@ts-ignore
    var camera = new Camera(vec3.fromValues(0, -1, 0), vec3.fromValues(0, 0, 0));
    //@ts-ignore
    var sun = new Light(vec3.fromValues(5, 7, 10));
    var tile = await TerrainTile.generateTerrainTile(gl, renderer.terrainRenderer.program, 20, await Texture.loadTexture(gl, "grass.jpg"), 343545454);
    var entity = await Model.loadModelWithSeperateResources(gl, renderer.entityRenderer.program, "cube", "teapot.png");
    var entity2 = await Model.loadModel(gl, renderer.entityRenderer.program, "stall");
    var entities = [];
    entities.push(new Entity(entity, [0, 0, 6], [0, 0, 0]));
    entities.push(new Entity(entity2, [0, 0, 12], [0, 0, 0], true));
    var then = millisToSeconds(Date.now());
    var deltaTime;
    var isPointerLocked = false;
    document.getElementById("webgl_canvas").onresize = () => {
        renderer.updateProjectionMatrix(gl);
    };
    window.onkeydown = async (ev) => {
        if (ev.code === "KeyC") {
            camera.pos[1] += Camera.SPEED * deltaTime;
        }
        else if (ev.code === "Space") {
            camera.pos[1] -= Camera.SPEED * deltaTime;
        }
        if (ev.code === "KeyW") {
            let distance = Camera.SPEED * deltaTime;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1]));
        }
        else if (ev.code === "KeyS") {
            let distance = Camera.SPEED * deltaTime;
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1]));
        }
        if (ev.code === "KeyA") {
            let distance = Camera.SPEED * deltaTime;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1] + 90));
        }
        else if (ev.code === "KeyD") {
            let distance = Camera.SPEED * deltaTime;
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
        updateEntities(entities, deltaTime);
        renderer.render(gl, camera, sun, entities, [tile]);
        window.requestAnimationFrame(mainLoop);
    }
}
