in vec3 in_pos;

uniform mat4 u_projectionViewTransformationMatrix;

void main(){
    gl_Position = u_projectionViewTransformationMatrix * in_pos;
}