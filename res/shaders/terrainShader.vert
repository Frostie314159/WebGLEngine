in vec4 in_pos;
in vec2 in_texCord;

out vec2 out_texCord;

uniform mat4 u_projectionViewTransformationMatrix;

void main(){
    out_texCord = in_texCord;
    gl_Position = u_projectionViewTransformationMatrix * in_pos;
}