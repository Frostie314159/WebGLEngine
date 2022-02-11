in vec4 in_pos;
in vec3 in_col;

out vec3 out_col;

void main(){
    out_col = in_col;
    gl_Position = in_pos;
}