in vec4 in_pos;
in vec3 in_normal;
in vec2 in_texCord;

out vec3 out_normal;
out vec2 out_texCord;

uniform mat4 u_projectionViewTransformationMatrix;
uniform mat4 u_transformInverseTransposeMatrix;

void main(){
    out_normal = mat3(u_transformInverseTransposeMatrix) * in_normal;
    out_texCord = in_texCord;
    gl_Position = u_projectionViewTransformationMatrix * in_pos;
}