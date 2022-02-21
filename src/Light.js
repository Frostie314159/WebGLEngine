//@ts-ignore
const { vec3 } = await import("./node_modules/gl-matrix/esm/index.js");
export class Light {
    dir;
    constructor(dir) {
        //@ts-ignore
        this.dir = vec3.create();
        //@ts-ignore
        vec3.normalize(this.dir, dir);
    }
}
