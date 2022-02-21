import { Program } from "./Program.js";
import { Entity } from "./Entity.js";
import { VAO } from "./VAO.js";
import { Model } from "./Model.js";
import { Texture } from "./Texture.js";
import { Camera } from "./Camera.js";
import { Light } from "./Light.js";
import { toRadians } from "./Util.js";

//@ts-ignore
import type { mat4, vec3 } from "gl-matrix";
//@ts-ignore
const { mat4, vec3 } = await import("./node_modules/gl-matrix/esm/index.js");
export class Renderer {
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
    public static async init(gl: WebGL2RenderingContext, programName: string): Promise<Renderer> {
        return new Promise<Renderer>(async (resolve) => {
            var renderer: Renderer = new Renderer();
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
        mat4.perspective(this.projectionMatrix, toRadians(Renderer.FOV), gl.canvas.width / gl.canvas.height, Renderer.NEAR_PLANE, Renderer.FAR_PLANE);
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
        if (camera.viewMatrix === null) {
            console.log(camera.viewMatrix);
        }
        //@ts-ignore
        mat4.mul(projectionViewMatrix, this.projectionMatrix, camera.viewMatrix);
        this.entityMap.forEach((currentEntities: Entity[], currentModelID: number) => {
            VAO.getVAO(Model.getModel(currentModelID).vaoID).enableVAO(gl);
            Texture.getTexture(Model.getModel(currentModelID).textureID).activateTexture(gl);
            currentEntities.forEach((currentEntity: Entity) => {
                if(currentEntity.disableBackFaceCulling){
                    gl.disable(WebGL2RenderingContext.CULL_FACE);
                }
                //@ts-ignore
                if (currentEntity.disableFarPlaneCulling || vec3.distance(camera.pos, currentEntity.pos) > Renderer.FAR_PLANE) {
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
                if(currentEntity.disableBackFaceCulling){
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