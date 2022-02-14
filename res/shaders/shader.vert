in vec4 in_pos;
in vec3 in_col;

out vec3 out_col;

uniform mat4 in_projectionViewMatrix;
uniform mat4 in_modelViewMatrix;

void main(){
    out_col = in_col;
    gl_Position = in_projectionViewMatrix * in_modelViewMatrix * in_pos;
}