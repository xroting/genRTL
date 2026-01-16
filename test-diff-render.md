# Diff渲染测试

请在AI对话中复制以下代码块，看看diff效果：

## 测试1: 简单的修改

```verilog
module counter (
  input wire clk,
  input wire rst_n,
- output reg [7:0] count
+ output reg [15:0] count
);
```

## 测试2: 多行修改

```verilog
module uart_tx (
  input wire clk,
  input wire rst_n,
- input wire [7:0] data_in,
+ input wire [15:0] data_in,
  input wire send,
- output reg tx,
+ output wire tx,
  output reg busy
);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
-     tx <= 1'b1;
      busy <= 1'b0;
    end else begin
      // transmission logic
    end
  end
+
+ assign tx = internal_tx;

endmodule
```

## 测试3: 删除旧代码，添加新代码

```systemverilog
module state_machine (
  input logic clk,
  input logic rst_n,
  output logic [2:0] state
);

- typedef enum logic [1:0] {
-   IDLE = 2'b00,
-   BUSY = 2'b01,
-   DONE = 2'b10
- } state_t;
-
- state_t current_state, next_state;
+ typedef enum logic [2:0] {
+   IDLE   = 3'b000,
+   START  = 3'b001,
+   BUSY   = 3'b010,
+   WAIT   = 3'b011,
+   DONE   = 3'b100
+ } state_t;
+
+ state_t current_state;

endmodule
```

---

## 如何使用

1. 复制上面的任意一个代码块
2. 在AI助手的**用户输入框**中粘贴
3. 发送消息
4. 查看AI的回复中，代码块是否显示了diff背景色

**预期效果：**
- 以 `-` 开头的行 → 浅红色背景
- 以 `+` 开头的行 → 浅绿色背景
- 普通行 → 无背景色

