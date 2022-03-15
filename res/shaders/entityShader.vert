in vec4 POSITION;
in vec3 NORMAL;
in vec2 TEXCOORD_0;

out vec3 out_normal;
out vec2 out_texCord;

uniform mat4 u_projectionViewTransformationMatrix;
uniform mat4 u_transformInverseTransposeMatrix;

void main(){
    out_normal = mat3(u_transformInverseTransposeMatrix) * NORMAL;
    out_texCord = TEXCOORD_0;
    gl_Position = u_projectionViewTransformationMatrix * POSITION;
}