# Diff 样式测试示例

## 示例1: Verilog模块修改

```verilog
module posedge_detector (
  input wire clk,
  input wire rst_n,
  input wire signal_in,
- output reg posedge_pulse
+ output wire posedge_pulse
);

  reg signal_in_d;
  
  always @(posedge clk or negedge rst_n)
    if (!rst_n) begin
      signal_in_d <= 1'b0;
-     posedge_pulse <= 1'b0;
    end else begin
-     signal_in_d <= signal_in;
-     posedge_pulse <= signal_in & ~signal_in_d;
+     signal_in_d <= signal_in;
    end
+
+ assign posedge_pulse = signal_in & ~signal_in_d;

endmodule
```

## 示例2: 算术模块修改

```verilog
module arith_mul_add (
  input wire [9:0] a,
  input wire [9:0] b,
  input wire [9:0] c,
  input wire [9:0] d,
- output wire [20:0] result
+ output wire [21:0] result  // 增加1位宽度
);

  wire [19:0] mul_ab;
  wire [19:0] mul_cd;
  
  assign mul_ab = a * b;
  assign mul_cd = c * d;
- assign result = mul_ab + mul_cd;
+ assign result = {1'b0, mul_ab} + {1'b0, mul_cd};  // 防止溢出

endmodule
```

## 示例3: 删除旧代码

```verilog
module counter (
  input wire clk,
  input wire rst_n,
  output reg [7:0] count
);

- // 旧的实现：使用阻塞赋值
- always @(posedge clk)
-   if (!rst_n)
-     count = 8'b0;
-   else
-     count = count + 1;
-
+ // 新的实现：使用非阻塞赋值
+ always @(posedge clk or negedge rst_n)
+   if (!rst_n)
+     count <= 8'b0;
+   else
+     count <= count + 1'b1;

endmodule
```

## 使用说明

**Diff标记规则：**
- `+` 开头的行 → 浅绿色背景（新增代码）
- `-` 开头的行 → 浅红色背景（删除代码）
- 普通行 → 无背景色

**注意：**
- `+++` 和 `---` 不会被识别为diff标记（这些是git diff的文件头）
- 必须在行首使用 `+` 或 `-` 符号
- 符号后面通常有一个空格，但不是必需的

