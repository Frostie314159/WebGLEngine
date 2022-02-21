//@ts-ignore
import type { vec3 } from "gl-matrix";
//@ts-ignore
const { vec3 } = await import("./node_modules/gl-matrix/esm/index.js");
export class Light {
    dir: vec3;
    constructor(dir: vec3) {
        //@ts-ignore
        this.dir = vec3.create();
        //@ts-ignore
        vec3.normalize(this.dir, dir);
    }
}