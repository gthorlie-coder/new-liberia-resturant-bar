import 'package:flutter/material.dart';

/// New Liberia Restaurant & Bar brand palette:
/// deep navy + warm gold, per the UI/UX guidelines.
class AppColors {
  static const navy = Color(0xFF12253F);
  static const gold = Color(0xFFB8863B);
  static const cream = Color(0xFFF4F1EA);
}

class AppTheme {
  static ThemeData light = ThemeData(
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.cream,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.navy,
      brightness: Brightness.light,
      primary: AppColors.navy,
      secondary: AppColors.gold,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.navy,
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    useMaterial3: true,
  );

  static ThemeData dark = ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: const Color(0xFF0B1524),
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.navy,
      brightness: Brightness.dark,
      primary: AppColors.gold,
      secondary: AppColors.gold,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF0B1524),
      foregroundColor: AppColors.gold,
      elevation: 0,
    ),
    useMaterial3: true,
  );
}
