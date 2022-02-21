//@ts-ignore
import { glMatrix, vec3 } from "gl-matrix";
//@ts-ignore
const vec3 = glMatrix;
export class Light {
    dir: vec3;
    constructor(dir: vec3) {
        //@ts-ignore
        this.dir = vec3.create();
        //@ts-ignore
        vec3.normalize(this.dir, dir);
    }
}