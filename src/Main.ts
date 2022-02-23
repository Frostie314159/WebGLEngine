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
            resolve(await VAO.loadVAOFromArray(gl, false,
                new VBOData(gl, vertexArray, program, "in_pos", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, normalArray, program, "in_normal", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, textureCordArray, program, "in_texCord", 2, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, new Uint16Array(indices), program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true)
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
            var image: HTMLImageElement = await loadImage(`res/assets/${textureName}.png`);
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
            model.textureID = await Texture.loadTexture(gl, name);
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
        this.rot[0] += 20 * deltaTime;
        this.rot[1] += 20 * deltaTime;
        this.rot[2] += 20 * deltaTime;
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
class TerrainTile {
    vaoID: number;
    pos: vec3;
    static TILE_SIZE = 100;
    public static async generateTerrainTile(gl: WebGL2RenderingContext, program:Program, resolution: number): Promise<TerrainTile> {
        return new Promise<TerrainTile>(async (resolve) => {
            var terrainTile: TerrainTile = new TerrainTile();

            let VERTICES_PER_ROW: number = resolution + 1;
            let VERTEX_COUNT: number = Math.pow(VERTICES_PER_ROW, 2);
            let QUADS_PER_ROW: number = resolution * 2;

            var vertices: Float32Array = new Float32Array(VERTEX_COUNT * 3);
            var normals: Float32Array = new Float32Array(VERTEX_COUNT * 3);
            var textureCords: Float32Array = new Float32Array(VERTEX_COUNT * 2);
            var indices: Uint16Array = new Uint16Array(QUADS_PER_ROW * resolution * 3);

            let STEP_SIZE: number = TerrainTile.TILE_SIZE / resolution;
            for (let X = 0; X < VERTICES_PER_ROW; X++) {
                for (let Y = 0; Y < VERTICES_PER_ROW; Y++) {
                    let CURRENT_INDEX: number = Y + X * VERTICES_PER_ROW;
                    vertices[CURRENT_INDEX * 3] = X * STEP_SIZE;
                    vertices[CURRENT_INDEX * 3 + 1] = 0;
                    vertices[CURRENT_INDEX * 3 + 2] = Y * STEP_SIZE;
                    
                    normals[CURRENT_INDEX * 3] = 0;
                    normals[CURRENT_INDEX * 3 + 1] = 1;
                    normals[CURRENT_INDEX * 3 + 2] = 0;

                    textureCords[CURRENT_INDEX * 2] = X * STEP_SIZE;
                    textureCords[CURRENT_INDEX * 2 + 1] = Y * (-STEP_SIZE + 1);
                }
            }
            for (let INDEX = 0; INDEX < Math.pow(resolution, 2) * 2; INDEX++){
                let UPPER_LEFT_VERTEX: number = INDEX * QUADS_PER_ROW;
                let UPPER_RIGHT_VERTEX: number = UPPER_LEFT_VERTEX + 1;
                let LOWER_LEFT_VERTEX: number = UPPER_LEFT_VERTEX + VERTICES_PER_ROW;
                let LOWER_RIGHT_VERTEX: number = LOWER_LEFT_VERTEX + 1;
                indices[INDEX * 6] =        LOWER_LEFT_VERTEX;
                indices[INDEX * 6 + 1] =    UPPER_LEFT_VERTEX;
                indices[INDEX * 6 + 2] =    UPPER_RIGHT_VERTEX;
                indices[INDEX * 6 + 3] =    LOWER_LEFT_VERTEX;
                indices[INDEX * 6 + 4] =    UPPER_RIGHT_VERTEX;
                indices[INDEX * 6 + 5] =    LOWER_RIGHT_VERTEX;
            }
            terrainTile.vaoID = await VAO.loadVAOFromArray(gl, true, 
                new VBOData(gl, vertices, program, "in_pos", 3, WebGL2RenderingContext.FLOAT),
                new VBOData(gl, indices, program, "", 1, WebGL2RenderingContext.UNSIGNED_SHORT, true)
            );
            terrainTile.pos = [0, 0, 0];
            console.log(vertices);
            console.log(indices);
            resolve(terrainTile);
        });
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
class EntityRenderer {
    program: Program;
    drawMode: number;
    projectionMatrix: mat4;
    projectionViewMatrixLocation: WebGLUniformLocation;
    transformationInverseTransposeMatrixLocation: WebGLUniformLocation;
    reverseLightDirectionLocation: WebGLUniformLocation;
    textureLocation: WebGLUniformLocation;
    entityMap: Map<number, Entity[]>;
    static FOV: number = 60;
    static NEAR_PLANE: number = 0.1;
    static FAR_PLANE: number = 100;
    public static async init(gl: WebGL2RenderingContext, programName: string): Promise<EntityRenderer> {
        return new Promise<EntityRenderer>(async (resolve) => {
            var renderer: EntityRenderer = new EntityRenderer();
            renderer.program = await Program.loadProgram(gl, programName);
            renderer.drawMode = WebGL2RenderingContext.TRIANGLES;
            //@ts-ignore
            renderer.projectionMatrix = mat4.create();
            renderer.updateProjectionMatrix(gl);
            renderer.projectionViewMatrixLocation = renderer.program.getUniformLocation(gl, "u_projectionViewTransformationMatrix");
            renderer.transformationInverseTransposeMatrixLocation = renderer.program.getUniformLocation(gl, "u_transformInverseTransposeMatrix");
            renderer.reverseLightDirectionLocation = renderer.program.getUniformLocation(gl, "u_reverseLightDirection");
            renderer.textureLocation = renderer.program.getUniformLocation(gl, "u_texture");
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
        mat4.perspective(this.projectionMatrix, toRadians(EntityRenderer.FOV), gl.canvas.width / gl.canvas.height, EntityRenderer.NEAR_PLANE, EntityRenderer.FAR_PLANE);
    }
    public prepareEntities(entities: Entity[]): void {
        this.entityMap = new Map<number, Entity[]>();
        entities.forEach((currentEntity: Entity) => {
            if (!this.entityMap.has(currentEntity.modelID)) {
                this.entityMap.set(currentEntity.modelID, []);
            }
            this.entityMap.get(currentEntity.modelID).push(currentEntity);
        });
    }
    public render(gl: WebGL2RenderingContext, camera: Camera, light: Light, entities: Entity[]): void {
        this.prepareEntities(entities);
        EntityRenderer.prepareViewport(gl);
        EntityRenderer.clear(gl);
        gl.enable(WebGL2RenderingContext.DEPTH_TEST);
        gl.depthFunc(WebGL2RenderingContext.LEQUAL);
        gl.enable(WebGL2RenderingContext.CULL_FACE);
        gl.cullFace(WebGL2RenderingContext.BACK);
        this.program.start(gl);
        //@ts-ignore
        var projectionViewMatrix: mat4 = mat4.create();
        camera.updateViewMatrix();
        if (camera.viewMatrix === null) {
            console.log(camera.viewMatrix);
        }
        //@ts-ignore
        mat4.mul(projectionViewMatrix, this.projectionMatrix, camera.viewMatrix);
        this.entityMap.forEach((currentEntities: Entity[], currentModelID: number) => {
            VAO.getVAO(Model.getModel(currentModelID).vaoID).enableVAO(gl);
            Texture.getTexture(Model.getModel(currentModelID).textureID).activateTexture(gl);
            currentEntities.forEach((currentEntity: Entity) => {
                if (currentEntity.disableBackFaceCulling) {
                    gl.disable(WebGL2RenderingContext.CULL_FACE);
                }
                //@ts-ignore
                if (currentEntity.disableFarPlaneCulling || vec3.distance(camera.pos, currentEntity.pos) > EntityRenderer.FAR_PLANE) {
                    return;
                }
                //@ts-ignore
                var currentTransformationMatrix: mat4 = currentEntity.createTransformationMatrix();
                //@ts-ignore
                this.program.loadDataToUniform(gl, this.projectionViewMatrixLocation, mat4.mul(mat4.create(), projectionViewMatrix, currentTransformationMatrix));
                //@ts-ignore
                mat4.invert(currentTransformationMatrix, currentTransformationMatrix);
                //@ts-ignore
                mat4.transpose(currentTransformationMatrix, currentTransformationMatrix);
                this.program.loadDataToUniform(gl, this.transformationInverseTransposeMatrixLocation, currentTransformationMatrix);
                this.program.loadDataToUniform(gl, this.reverseLightDirectionLocation, light.dir);
                if (VAO.vaos[Model.getModel(currentModelID).vaoID].containsIndexBuffer) {
                    gl.drawElements(this.drawMode, VAO.vaos[Model.getModel(currentModelID).vaoID].length, gl.UNSIGNED_SHORT, 0);
                } else {
                    gl.drawArrays(this.drawMode, 0, VAO.vaos[Model.getModel(currentModelID).vaoID].length);
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
class TerrainRenderer{
    program:Program;
    public static async init(gl:WebGL2RenderingContext, programName:string): Promise<TerrainRenderer>{
        return new Promise<TerrainRenderer>(async (resolve) => {
            var terrainRenderer:TerrainRenderer = new TerrainRenderer();
            terrainRenderer.program = await Program.loadProgram(gl, programName);
            resolve(terrainRenderer);
        });
    }
    public render(gl:WebGL2RenderingContext, projectionMatrix:mat4, terrainTiles:TerrainTile[]): void{
        
    }
}
class MasterRenderer {
    entityRenderer: EntityRenderer;

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
async function init(): Promise<void> {
    var gl: WebGL2RenderingContext = await createContext();

    var renderer: EntityRenderer = await EntityRenderer.init(gl, "shader");

    //@ts-ignore
    var camera: Camera = new Camera(vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 0));

    //@ts-ignore
    var sun: Light = new Light(vec3.fromValues(5, 7, 10));

    var tile: TerrainTile = await TerrainTile.generateTerrainTile(gl, renderer.program, 2);

    var entity: number = await Model.loadModelWithSeperateResources(gl, renderer.program, "cube", "teapot");
    var entity2: number = await Model.loadModelWithSeperateResources(gl, renderer.program, "teapot", "mytree");
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
            renderer.drawMode = (renderer.drawMode === WebGL2RenderingContext.TRIANGLES) ? WebGL2RenderingContext.LINES : WebGL2RenderingContext.TRIANGLES;
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
        renderer.render(gl, camera, sun, entities);
        window.requestAnimationFrame(mainLoop);
    }
}