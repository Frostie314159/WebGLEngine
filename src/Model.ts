import { VAO } from "./VAO.js";
import { Program } from "./Program.js";
import { Texture } from "./Texture.js";
export class Model {
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
}