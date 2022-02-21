import { VAO } from "./VAO.js";
import { Texture } from "./Texture.js";
export class Model {
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
            model.textureID = await Texture.loadTexture(gl, name);
            Model.models.push(model);
            resolve(Model.models.length - 1);
        });
    }
}
