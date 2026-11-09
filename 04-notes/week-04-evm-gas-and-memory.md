EVM 的 gas 消耗跟 memory 使用量的关系是：

```solidity
memory_size_word = (memory_byte_size + 31) / 32
memory_cost = (memory_size_word ** 2) / 512 + (3 * memory_size_word)
```