<template>
  <div
    class="admission-card"
    :style="admissionCardStyle"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <el-button
      v-if="hover"
      class="admission-edit-trigger"
      size="mini"
      type="primary"
      plain
      @click="$emit('edit')"
    >
      修改
    </el-button>
    <div class="admission-title">准考证号</div>
    <div class="admission-inputs" :style="admissionGridStyle">
      <span
        v-for="digit in effectiveAdmissionColumns"
        :key="`input-${digit}`"
        class="admission-input-cell"
      ></span>
    </div>
    <div class="admission-grid">
      <div v-for="digit in 10" :key="`digit-${digit}`" class="admission-grid-row" :style="admissionGridStyle">
        <div
          v-for="col in effectiveAdmissionColumns"
          :key="`digit-${digit - 1}-col-${col}`"
          class="admission-grid-cell"
        >
          <span class="digit">{{ digit - 1 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AdmissionCard',
  props: {
    admissionCardStyle: { type: Object, default: () => ({}) },
    admissionGridStyle: { type: Object, default: () => ({}) },
    effectiveAdmissionColumns: { type: Number, default: 9 }
  },
  data() {
    return { hover: false };
  }
};
</script>

<style scoped>
.admission-card {
  box-sizing: border-box;
  flex-shrink: 0;
  height: 100%;
  border: 1px solid #000;
  padding: 6px;
  position: relative;
}

.admission-edit-trigger {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 3;
}

.admission-title {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #000;
  border-bottom: 1px solid #000;
  padding-bottom: 4px;
  margin-bottom: 5px;
  white-space: nowrap;
}

.admission-inputs {
  display: grid;
  column-gap: 5px;
  row-gap: 5px;
  margin-bottom: 6px;
}

.admission-input-cell {
  width: 23px;
  height: 23px;
  border: 1px solid #000;
}

.admission-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admission-grid-row {
  display: grid;
  column-gap: 5px;
}

.admission-grid-cell {
  border: 1px solid #000;
  width: 23px;
  height: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.digit {
  font-size: 8px;
  line-height: 1;
  color: #000;
}
</style>
