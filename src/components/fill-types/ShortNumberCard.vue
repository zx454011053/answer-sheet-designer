<template>
  <div class="short-number-card">
    <table class="short-number-table">
      <tbody>
        <tr v-for="(label, idx) in shortNumberRowLabels" :key="`short-row-${idx}`">
          <th>{{ label }}</th>
          <td class="short-number-blank"></td>
          <td v-for="num in 10" :key="`short-${idx}-${num}`">{{ num - 1 }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'ShortNumberCard',
  props: {
    shortNumberRowLabels: { type: Array, default: () => [] }
  }
};
</script>

<style scoped>
.short-number-card {
  height: 68px;
  box-sizing: border-box;
}

.short-number-table {
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;
  color: #000;
}

.short-number-table th,
.short-number-table td {
  border: 1px solid #000;
  padding: 0;
  text-align: center;
  height: 17px;
  line-height: 17px;
  white-space: nowrap;
}

.short-number-table th {
  width: 20px;
  font-weight: 500;
}

.short-number-table td {
  width: 16px;
}

.short-number-table td.short-number-blank {
  color: transparent;
}
</style>
