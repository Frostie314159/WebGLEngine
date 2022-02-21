//@ts-ignore
import type { vec3, mat4 } from "gl-matrix";
//@ts-ignore
const { vec3, mat4 } = await import("./node_modules/gl-matrix/esm/index.js");
export class Entity {
    modelID: number;
    pos: vec3;
    rot: vec3;
    disableFarPlaneCulling: boolean;
    disableBackFaceCulling: boolean;
    static G = 9.81;
    constructor(modelID: number, pos: vec3, rot: vec3, disableBackFaceCulling:boolean = false, disableFarPlaneCulling: boolean = false) {
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
        this.rot[1] += 5 * deltaTime;
    }
    public createTransformationMatrix(): mat4 {
        //@ts-ignore
        var transformationMatrix: mat4 = mat4.create();
        //@ts-ignore
        mat4.translate(transformationMatrix, transformationMatrix, vec3.negate(vec3.create(), this.pos));
        //@ts-ignore
        mat4.rotateX(transformationMatrix, transformationMatrix, this.rot[0]);
        //@ts-ignore
        mat4.rotateY(transformationMatrix, transformationMatrix, this.rot[1]);
        //@ts-ignore
        mat4.rotateZ(transformationMatrix, transformationMatrix, this.rot[2]);
        return transformationMatrix;
    }
}