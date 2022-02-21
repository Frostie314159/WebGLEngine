import { Entity } from "./Entity.js";
import { createContext, millisToSeconds, toRadians } from "./Util.js";
import { Renderer } from "./Renderer.js";
import { Model } from "./Model.js";
import { Camera } from "./Camera.js";
async function updateEntities(entities, deltaTime) {
    entities.forEach((currentEntity) => {
        currentEntity.update(deltaTime);
    });
}
export async function init() {
    var gl = await createContext();
    var renderer = await Renderer.init(gl, "shader");
    //@ts-ignore
    var camera = new Camera(vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 0));
    //@ts-ignore
    var sun = new Light(vec3.fromValues(5, 7, 10));
    var suzanne = await Model.loadModel(gl, renderer.program, "teapot");
    var entities = [];
    for (let i = 0; i < 1; i++) {
        entities.push(new Entity(suzanne, [6 * i, 0, 6], [0, 0, 0], true));
    }
    var then = millisToSeconds(Date.now());
    var deltaTime;
    var isPointerLocked = false;
    document.getElementById("webgl_canvas").onresize = () => {
        renderer.updateProjectionMatrix(gl);
    };
    window.onkeydown = async (ev) => {
        if (ev.code === "KeyC") {
            camera.pos[1] -= Camera.SPEED * deltaTime;
        }
        else if (ev.code === "Space") {
            camera.pos[1] += Camera.SPEED * deltaTime;
        }
        if (ev.code === "KeyW") {
            let distance = Camera.SPEED * deltaTime;
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1]));
        }
        else if (ev.code === "KeyS") {
            let distance = Camera.SPEED * deltaTime;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1]));
        }
        if (ev.code === "KeyA") {
            let distance = Camera.SPEED * deltaTime;
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1] + 90));
        }
        else if (ev.code === "KeyD") {
            let distance = Camera.SPEED * deltaTime;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1] + 90));
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
        renderer.render(gl, camera, sun, entities);
        window.requestAnimationFrame(mainLoop);
    }
}
