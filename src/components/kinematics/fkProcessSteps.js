const fkProcessSteps = [
    {
        number: 0,
        title: 'Base Frame',
        content: [
            {
                type: 'line',
                parts: ['Identity transform at base: '],
            },
            {
                type: 'blockMath',
                value: String.raw`^0T_0 = I_4 = \begin{bmatrix}
1 & 0 & 0 & 0 \\
0 & 1 & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
            },
        ],
    },
    {
        number: 1,
        title: 'Base -> Joint-1',
        content: [
            {
                type: 'line',
                parts: ['First rotation: ', { type: 'inlineMath', value: '\\theta_1' }],
            },
            {
                type: 'blockMath',
                value: String.raw`^0T_1 = f(\theta_1) = \mathbf{Rot_z(\theta_1)}`,
            },
            {
                type: 'text',
                value: 'Transformation matrix:',
            },
            {
                type: 'blockMath',
                value: String.raw`^0T_1 = \begin{bmatrix}
C_1 & -S_1 & 0 & 0 \\
S_1 & C_1 & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
            },
            {
                type: 'text',
                value: ', where: ',
            },
            {
                type: 'blockMath',
                value: 'C_1=\\cos\\theta_1,\\; S_1=\\sin\\theta_1, \\; C_{12}=\\cos(\\theta_1+\\theta_2),\\; S_{12}=\\sin(\\theta_1+\\theta_2)',
            },
        ],
    },
    {
        number: 2,
        title: 'Base -> Joint-2',
        content: [
            {
                type: 'line',
                parts: ['Combined rotation function: ', { type: 'inlineMath', value: 'f(\\theta_1,\\theta_2)' }],
            },
            {
                type: 'blockMath',
                value: String.raw`^0T_2 = f(\theta_1,\theta_2) = Rot_z(\theta_1) \cdot \mathbf{Trans(L_1) \cdot Rot_z(\theta_2)}`,
            },
            {
                type: 'text',
                value: 'Transformation matrix:',
            },
            {
                type: 'blockMath',
                value: String.raw`^0T_2 = \begin{bmatrix}
C_{12} & -S_{12} & 0 & L_1C_1 \\
S_{12} & C_{12} & 0 & L_1S_1 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
            },
        ],
    },
    {
        number: 3,
        title: 'Base -> Joint-3',
        content: [
            {
                type: 'line',
                parts: ['Move ', { type: 'inlineMath', value: 'L_2' }, ' and add final joint angle ', { type: 'inlineMath', value: '\\theta_3' }, ' to complete orientation.'],
            },
            {
                type: 'blockMath',
                value: String.raw`^0T_3 = f(\theta_1,\theta_2,\theta_3) = Rot_z(\theta_1) \cdot Trans(L_1) \cdot Rot_z(\theta_2) \cdot \mathbf{Trans(L_2) \cdot Rot_z(\theta_3)}`,
            },
            {
                type: 'blockMath',
                value: String.raw`^0T_3 = \begin{bmatrix}
C_{123} & -S_{123} & 0 & L_1C_1 + L_2C_{12} \\
S_{123} & C_{123} & 0 & L_1S_1 + L_2S_{12} \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
            },
        ],
    },
    {
        number: 4,
        title: 'Base -> End-Effector',
        content: [
            {
                type: 'line',
                parts: ['A final translation by ', { type: 'inlineMath', value: 'L_3' }],
            },
            {
                type: 'blockMath',
                value: String.raw`^0T_4 = f(\theta_1,\theta_2,\theta_3) = R(\theta_1) \cdot T(L_1) \cdot R(\theta_2) \cdot T(L_2) \cdot R(\theta_3) \cdot \mathbf{T(L_3)}`,
            },
            {
                type: 'blockMath',
                value: String.raw`^0T_{4} = \begin{bmatrix}
C_{123} & -S_{123} & 0 & L_1C_1 + L_2C_{12} + L_3C_{123} \\
S_{123} & C_{123} & 0 & L_1S_1 + L_2S_{12} + L_3S_{123} \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
            },
        ],
    },
];

export default fkProcessSteps;