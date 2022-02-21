import { Entity } from "./Entity.js";
import { createContext, millisToSeconds, toRadians } from "./Util.js";
import { Renderer } from "./Renderer.js";
import { Model } from "./Model.js";
import { Camera } from "./Camera.js";
async function updateEntities(entities: Entity[], deltaTime: number): Promise<void> {
    entities.forEach((currentEntity: Entity) => {
        currentEntity.update(deltaTime);
    });
}
export async function init(): Promise<void> {
    var gl: WebGL2RenderingContext = await createContext();

    var renderer: Renderer = await Renderer.init(gl, "shader");

    //@ts-ignore
    var camera: Camera = new Camera(vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 0));

    //@ts-ignore
    var sun: Light = new Light(vec3.fromValues(5, 7, 10));

    var suzanne: number = await Model.loadModel(gl, renderer.program, "teapot");
    var entities: Entity[] = [];
    for (let i: number = 0; i < 1; i++) {
        entities.push(new Entity(suzanne, [6 * i, 0, 6], [0, 0, 0], true));
    }

    var then: number = millisToSeconds(Date.now());
    var deltaTime: number;
    var isPointerLocked: boolean = false;

    document.getElementById("webgl_canvas").onresize = () => {
        renderer.updateProjectionMatrix(gl);
    };
    window.onkeydown = async (ev: KeyboardEvent) => {
        if (ev.code === "KeyC") {
            camera.pos[1] -= Camera.SPEED * deltaTime;
        } else if (ev.code === "Space") {
            camera.pos[1] += Camera.SPEED * deltaTime;
        }
        if (ev.code === "KeyW") {
            let distance: number = Camera.SPEED * deltaTime;
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1]));
        } else if (ev.code === "KeyS") {
            let distance: number = Camera.SPEED * deltaTime;
            camera.pos[0] += distance * Math.sin(toRadians(camera.rot[1]));
            camera.pos[2] += distance * Math.cos(toRadians(camera.rot[1]));
        }
        if (ev.code === "KeyA") {
            let distance: number = Camera.SPEED * deltaTime;
            camera.pos[0] -= distance * Math.sin(toRadians(camera.rot[1] + 90));
            camera.pos[2] -= distance * Math.cos(toRadians(camera.rot[1] + 90));
        } else if (ev.code === "KeyD") {
            let distance: number = Camera.SPEED * deltaTime;
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
        if(ev.code === "KeyM"){
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