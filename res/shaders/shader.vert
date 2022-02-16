in vec4 in_pos;
in vec3 in_normal;

out vec3 out_normal;

uniform mat4 u_projectionViewMatrix;
uniform mat4 u_transformationMatrix;

void main(){
    out_normal = in_normal;
    gl_Position = u_projectionViewMatrix * u_transformationMatrix * in_pos;
}