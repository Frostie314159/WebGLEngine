//@ts-ignore
const { vec3, mat4 } = await import("./node_modules/gl-matrix/esm/index.js");
export class Camera {
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
        //@ts-ignore
        mat4.rotateX(this.viewMatrix, this.viewMatrix, this.rot[0]);
        //@ts-ignore
        mat4.rotateY(this.viewMatrix, this.viewMatrix, this.rot[1]);
        //@ts-ignore
        mat4.rotateZ(this.viewMatrix, this.viewMatrix, this.rot[2]);
        //@ts-ignore
        this.viewMatrix = mat4.invert(this.viewMatrix, this.viewMatrix);
    }
}
